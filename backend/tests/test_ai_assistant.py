import os
import unittest
from datetime import date
from unittest.mock import patch

import httpx

os.environ.setdefault("DATABASE_URL", "sqlite://")
os.environ.setdefault("SECRET_KEY", "isolated-ai-test-key")

from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.ai.provider import ai_status, generate_completion, provider_configuration
from app.ai.routes import _extract_action, _offline_reply, _owned_conversation, chat, get_settings, save_settings
from app.ai.schemas import AIChatRequest, AISettingsPayload
from app.account.schemas import AppSettingsPayload
from app.database import Base, settings
from app.models.ai import AIConversation, AIMessage, AIUserSettings
from app.models.bank_account import BankAccount, BankTransaction
from app.models.finance_entry import FinanceEntry
from app.models.goal import Goal
from app.models.habit import Habit
from app.models.habit_completion import HabitCompletion
from app.models.journal_entry import JournalEntry
from app.models.learning_plan import LearningPlan
from app.models.task import Task
from app.models.user import User


class AIProviderTests(unittest.TestCase):
    def test_openai_provider_uses_server_key_and_does_not_expose_it_in_status(self):
        with patch.object(settings, "ai_provider", "openai"), patch.object(settings, "ai_api_key", "test-secret"), patch.object(
            settings, "ai_model", "test-model"
        ), patch.object(settings, "ai_base_url", None):
            self.assertTrue(ai_status()["configured"])
            self.assertNotIn("test-secret", str(ai_status()))
            response = _FakeResponse({"choices": [{"message": {"content": "Hello from the test model."}}]})
            with patch("app.ai.provider.httpx.post", return_value=response) as request:
                answer = generate_completion([{"role": "user", "content": "Hello"}])

        self.assertEqual(answer, "Hello from the test model.")
        self.assertEqual(request.call_args.kwargs["headers"]["Authorization"], "Bearer test-secret")

    def test_user_model_override_uses_server_provider_secret(self):
        with patch.object(settings, "ai_provider", "openai"), patch.object(settings, "ai_api_key", "test-secret"), patch.object(
            settings, "ai_model", "server-model"
        ), patch.object(settings, "ai_base_url", None):
            config = provider_configuration("openai", "user-selected-model")

        self.assertTrue(config["configured"])
        self.assertEqual(config["model"], "user-selected-model")
        self.assertEqual(config["api_key"], "test-secret")

    def test_ollama_provider_is_local_and_uses_chat_endpoint(self):
        with patch.object(settings, "ai_provider", "ollama"), patch.object(settings, "ollama_model", "small-local-model"), patch.object(
            settings, "ollama_base_url", "http://ollama:11434/"
        ), patch.object(settings, "ai_api_key", "unused-secret"):
            status = ai_status()
            response = _FakeResponse({"message": {"content": "Local answer."}})
            with patch("app.ai.provider.httpx.post", return_value=response) as request:
                answer = generate_completion([{"role": "user", "content": "Hello"}])

        self.assertTrue(status["local"])
        self.assertFalse(status["data_sent_externally"])
        self.assertEqual(request.call_args.args[0], "http://ollama:11434/api/chat")
        self.assertEqual(answer, "Local answer.")

    def test_unconfigured_provider_gives_setup_state_without_calling_network(self):
        with patch.object(settings, "ai_provider", "openai"), patch.object(settings, "ai_api_key", None), patch.object(
            settings, "ai_model", "test-model"
        ), patch("app.ai.provider.httpx.post") as request:
            self.assertFalse(ai_status()["configured"])
            with self.assertRaises(ValueError):
                generate_completion([{"role": "user", "content": "Hello"}])
            request.assert_not_called()

    def test_status_names_all_missing_server_settings(self):
        with patch.object(settings, "ai_provider", "openai"), patch.object(settings, "ai_api_key", None), patch.object(
            settings, "ai_model", None
        ):
            status = ai_status()

        self.assertFalse(status["configured"])
        self.assertIn("AI_MODEL", status["message"])
        self.assertIn("AI_API_KEY", status["message"])
        self.assertNotIn("None", status["message"])

    def test_provider_http_error_is_actionable_without_echoing_response_body(self):
        response = httpx.Response(
            401,
            request=httpx.Request("POST", "https://api.openai.com/v1/chat/completions"),
            text="do-not-show-this-secret-like-provider-payload",
        )
        with patch.object(settings, "ai_provider", "openai"), patch.object(settings, "ai_api_key", "test-secret"), patch.object(
            settings, "ai_model", "test-model"
        ), patch.object(settings, "ai_base_url", None), patch("app.ai.provider.httpx.post", return_value=response):
            with self.assertRaisesRegex(RuntimeError, "rejected the server credentials") as error:
                generate_completion([{"role": "user", "content": "Hello"}])

        self.assertNotIn("do-not-show-this-secret-like-provider-payload", str(error.exception))
        self.assertNotIn("test-secret", str(error.exception))

    def test_task_action_marker_is_parsed_but_requires_valid_explicit_payload(self):
        clean, action = _extract_action(
            'I can set that up.\n<!--DISCIPLINE_ACTION:{"type":"create_task","title":"Read chapter 2","due_date":"2026-10-15","due_time":"19:30"}-->'
        )
        self.assertEqual(clean, "I can set that up.")
        self.assertEqual(action.title, "Read chapter 2")
        self.assertEqual(action.due_time.isoformat(timespec="minutes"), "19:30")
        self.assertIsNone(_extract_action("Here is a suggestion, without an action marker.")[1])


class AIConversationOwnershipTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite://")
        Base.metadata.create_all(
            self.engine,
            tables=[
                User.__table__, AIUserSettings.__table__, AIConversation.__table__, AIMessage.__table__,
                BankAccount.__table__, BankTransaction.__table__, FinanceEntry.__table__, Task.__table__,
                Goal.__table__, Habit.__table__, HabitCompletion.__table__, LearningPlan.__table__, JournalEntry.__table__,
            ],
        )
        self.session = sessionmaker(bind=self.engine)()
        self.owner = User(email="ai-owner@example.com", password_hash="unused", full_name="Owner")
        self.other = User(email="ai-other@example.com", password_hash="unused", full_name="Other")
        self.session.add_all([self.owner, self.other])
        self.session.commit()
        self.conversation = AIConversation(user_id=self.owner.id, title="Private conversation")
        self.session.add(self.conversation)
        self.session.commit()

    def tearDown(self):
        self.session.close()
        Base.metadata.drop_all(
            self.engine,
            tables=[
                User.__table__, AIUserSettings.__table__, AIConversation.__table__, AIMessage.__table__,
                BankTransaction.__table__, FinanceEntry.__table__, BankAccount.__table__, Task.__table__,
                HabitCompletion.__table__, Habit.__table__, Goal.__table__, LearningPlan.__table__, JournalEntry.__table__,
            ],
        )
        self.engine.dispose()

    def test_users_cannot_read_another_users_conversation(self):
        self.assertEqual(_owned_conversation(self.session, self.owner.id, self.conversation.id).id, self.conversation.id)
        with self.assertRaises(HTTPException) as error:
            _owned_conversation(self.session, self.other.id, self.conversation.id)
        self.assertEqual(error.exception.status_code, 404)

    def test_ai_privacy_preferences_are_saved_per_account(self):
        saved = save_settings(
            payload=AISettingsPayload(
                memory_enabled=False,
                journal_sharing_enabled=True,
                provider="ollama",
                model="qwen2.5:7b",
            ),
            db=self.session,
            current_user=self.owner,
        )
        restored = get_settings(db=self.session, current_user=self.owner)
        other_account = get_settings(db=self.session, current_user=self.other)

        self.assertFalse(saved.memory_enabled)
        self.assertTrue(restored.journal_sharing_enabled)
        self.assertEqual(restored.provider, "ollama")
        self.assertEqual(restored.model, "qwen2.5:7b")
        self.assertTrue(other_account.memory_enabled)
        self.assertFalse(other_account.journal_sharing_enabled)
        self.assertEqual(other_account.provider, "server-default")

    def test_chat_saves_real_turns_and_never_sends_journal_text_when_private(self):
        private_entry = JournalEntry(
            user_id=self.owner.id,
            entry_date=date.today(),
            mood="calm",
            answers={"reflection": "private journal phrase that must stay on the server"},
        )
        task = Task(user_id=self.owner.id, title="Prepare project notes", is_completed=False)
        self.session.add_all([private_entry, task])
        self.session.commit()
        seen_messages = []

        def fake_provider_call(messages, preferences=None):
            seen_messages.extend(messages)
            return "Start with your project notes."

        with patch("app.ai.routes.ai_status", return_value={"configured": True}), patch(
            "app.ai.routes._provider_call", side_effect=fake_provider_call
        ):
            response = chat(
                payload=AIChatRequest(message="What should I do next?"),
                db=self.session,
                current_user=self.owner,
            )

        self.assertEqual(response["reply"], "Start with your project notes.")
        self.assertIn("Prepare project notes", str(seen_messages))
        self.assertNotIn("private journal phrase", str(seen_messages))
        self.assertEqual(self.session.query(AIConversation).filter_by(user_id=self.owner.id).count(), 2)
        self.assertEqual(self.session.query(AIMessage).count(), 2)

    def test_chat_works_in_local_mode_without_calling_a_provider(self):
        task = Task(user_id=self.owner.id, title="Finish backend setup", is_completed=False)
        self.session.add(task)
        self.session.commit()

        with patch("app.ai.routes.ai_status", return_value={"configured": False}), patch(
            "app.ai.routes._provider_call"
        ) as provider_call:
            response = chat(
                payload=AIChatRequest(message="What task should I focus on?"),
                db=self.session,
                current_user=self.owner,
            )

        self.assertIn("Finish backend setup", response["reply"])
        self.assertEqual(self.session.query(AIMessage).count(), 2)
        provider_call.assert_not_called()

    def test_local_assistant_summaries_use_only_available_records(self):
        context = {
            "tasks": {"open_count": 2, "completed_count": 3, "items": []},
            "goals": [],
            "habits": [{"name": "Read", "current_streak": 4, "completions_last_7_days": 5}],
            "learning_plans": [],
            "finance_last_30_days": {"totals_by_kind_and_currency": [{"kind": "expense", "currency": "AFN", "amount": "500"}]},
        }

        self.assertIn("Expense: AFN 500", _offline_reply("How much did I spend?", context))
        self.assertIn("5 completions in the last 7 days", _offline_reply("How are my habits?", context))
        self.assertIn("2 open tasks", _offline_reply("daily", context, "daily"))
        self.assertIn("current snapshot", _offline_reply("Give me a summary of my week", context))


class NotificationSoundSettingsTests(unittest.TestCase):
    def test_older_saved_settings_receive_alarm_sound_default(self):
        settings_payload = AppSettingsPayload.model_validate({"notifications": {"late_tasks": False}})
        self.assertFalse(settings_payload.notifications.late_tasks)
        self.assertEqual(settings_payload.notifications.sound, "alarm")


class _FakeResponse:
    def __init__(self, payload):
        self.payload = payload

    def raise_for_status(self):
        return None

    def json(self):
        return self.payload


if __name__ == "__main__":
    unittest.main()
