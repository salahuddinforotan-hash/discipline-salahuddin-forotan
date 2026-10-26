import type { LanguagePreference } from "./api";

type TranslationState = { source: string; rendered: string };

const persian: Record<string, string> = {
  "Dashboard": "داشبورد", "Home": "خانه", "Tasks": "کارها", "Task": "کار", "Goals": "هدف‌ها",
  "Habits": "عادت‌ها", "Income": "درآمد", "Income & expenses": "درآمد و مصارف", "Expenses": "مصارف",
  "Learning": "یادگیری", "Learn": "یادگیری", "Journal": "یادداشت روزانه", "Settings": "تنظیمات",
  "AI Assistant": "دستیار هوش مصنوعی", "More": "بیشتر", "Page": "صفحه", "All pages": "همه صفحه‌ها",
  "Search everything": "جستجوی همه‌چیز", "Search (Ctrl+K)": "جستجو (Ctrl+K)", "Search": "جستجو",
  "Search tasks, habits, goals, journal…": "جستجوی کارها، عادت‌ها، هدف‌ها و یادداشت‌ها…",
  "Search transactions...": "جستجوی تراکنش‌ها...", "Search transactions": "جستجوی تراکنش‌ها",
  "Search history": "جستجو در تاریخچه", "Close search": "بستن جستجو", "Close menu": "بستن فهرست",
  "Notifications": "اعلان‌ها", "No notifications yet.": "هنوز اعلانی وجود ندارد.",
  "You’re all caught up": "همه اعلان‌ها را بررسی کرده‌اید", "Mark all read": "همه را خوانده‌شده علامت بزن",
  "Close notifications": "بستن اعلان‌ها", "More navigation": "صفحه‌های بیشتر",
  "Notifications, none unread": "اعلان‌ها، اعلان خوانده‌نشده‌ای ندارید",
  "Show time picker": "نمایش انتخاب‌گر زمان", "Indigo accent": "رنگ نیلی", "Violet accent": "رنگ بنفش",
  "Blue accent": "رنگ آبی", "Emerald accent": "رنگ زمردی", "Rose accent": "رنگ صورتی",
  "Your daily overview": "نمای کلی روزانه شما", "Your task list": "فهرست کارهای شما",
  "Your active goals": "هدف‌های فعال شما", "Daily, weekly, and monthly habits": "عادت‌های روزانه، هفتگی و ماهانه",
  "Your financial overview": "نمای کلی مالی شما", "Your study plans": "برنامه‌های درسی شما",
  "Your private reflections": "یادداشت‌های خصوصی شما", "Plan your next step": "گام بعدی خود را برنامه‌ریزی کنید",
  "Account and app preferences": "حساب کاربری و تنظیمات برنامه",
  "Active habits": "عادت‌های فعال", "Add an expense": "ثبت یک مصرف", "Alerts": "هشدارها",
  "Author not added": "نام نویسنده ثبت نشده", "Create a study plan": "ایجاد برنامه درسی",
  "Define a habit you want to repeat consistently.": "عادتی را مشخص کنید که می‌خواهید مرتب تکرار کنید.",
  "Define exactly what needs to be done.": "دقیقاً مشخص کنید چه کاری باید انجام شود.", "Don't have an account?": "حساب ندارید؟",
  "Edit habit": "ویرایش عادت", "Next month": "ماه بعد", "Previous month": "ماه قبل", "Planning": "برنامه‌ریزی",
  "Read-only overview of your schedule": "نمای فقط‌خواندنی برنامه شما", "Score averages task completion, daily habits, active-goal progress, and today’s journal when each applies.": "امتیاز بر اساس تکمیل کارها، عادت‌های روزانه، پیشرفت هدف‌های فعال و یادداشت امروز محاسبه می‌شود.",
  "Today’s tasks": "کارهای امروز", "Turn your priorities into concrete actions.": "اولویت‌های خود را به کارهای مشخص تبدیل کنید.",
  "Version 1.0": "نسخه ۱.۰", "View plans": "نمایش برنامه‌ها", "Your reading plans": "برنامه‌های مطالعه شما",
  "all": "همه", "assistant": "دستیار", "net": "خالص", "of": "از", "open": "باز", "per week": "در هفته",
  "plan": "برنامه", "plans": "برنامه‌ها", "study": "مطالعه", "to confirm.": "برای تأیید.", "unread": "خوانده‌نشده",
  "A complete record of your income and spending.": "گزارش کامل درآمد و مصارف شما.",
  "A few prompts to help you get started.": "چند پرسش برای کمک به شروع شما.", "A private place to notice your progress and reset your focus.": "فضایی خصوصی برای دیدن پیشرفت و تمرکز دوباره.",
  "A small reset": "شروع دوباره‌ای کوچک", "Add a salary": "افزودن معاش", "Add salary": "افزودن معاش",
  "Add salary or income": "افزودن معاش یا درآمد", "Add your salary": "معاش خود را ثبت کنید",
  "Add your salary or first expense to see your monthly cash flow.": "برای دیدن جریان مالی ماهانه، معاش یا نخستین مصرف خود را ثبت کنید.",
  "Add a book, set your study hours and finish date, and get a page-by-page plan for the day, week, and month.": "کتاب را اضافه کنید، ساعت مطالعه و تاریخ پایان را تعیین کنید تا برنامه روزانه، هفتگی و ماهانه صفحه‌به‌صفحه بسازید.",
  "Books and study targets in progress": "کتاب‌ها و هدف‌های مطالعاتی در جریان", "Books in your plan": "کتاب‌های برنامه شما",
  "Build a realistic routine": "یک برنامه واقع‌بینانه بسازید", "Build consistency through small actions every day.": "با کارهای کوچک روزانه، استمرار بسازید.",
  "Choose a book and finish date. Your daily, weekly, and monthly reading goals adjust as you progress.": "کتاب و تاریخ پایان را انتخاب کنید. هدف‌های مطالعه روزانه، هفتگی و ماهانه با پیشرفت شما تنظیم می‌شوند.",
  "Daily pages are calculated from the pages you have left, your finish date, and the number of study days you choose. Weekly and monthly targets update with your progress.": "تعداد صفحه‌های روزانه بر اساس صفحه‌های باقی‌مانده، تاریخ پایان و روزهای مطالعه انتخابی شما محاسبه می‌شود. هدف‌های هفتگی و ماهانه نیز با پیشرفت شما به‌روز می‌شوند.",
  "Keep your salary, spending, and monthly balance in one clear view.": "معاش، مصارف و تراز ماهانه خود را یک‌جا ببینید.", "Keep it focused": "روی کار اصلی تمرکز کنید",
  "Get a clear next step from the plans you have already made.": "از برنامه‌هایی که ساخته‌اید، گام بعدی روشنی بگیرید.",
  "Built-in · no external AI connection": "دستیار داخلی · بدون اتصال به هوش مصنوعی بیرونی",
  "Refresh plans": "به‌روزرسانی برنامه‌ها", "Refreshing plans…": "در حال به‌روزرسانی برنامه‌ها…",
  "Hide transactions": "پنهان کردن تراکنش‌ها",
  "Built-in planning mode uses Tasks, Goals, Habits, and Learning only. Journal entries and financial records are excluded, and messages are not sent to an external AI service.": "حالت برنامه‌ریزی داخلی فقط از کارها، هدف‌ها، عادت‌ها و یادگیری استفاده می‌کند. یادداشت‌ها و سوابق مالی شامل نمی‌شوند و پیام‌ها به سرویس هوش مصنوعی بیرونی فرستاده نمی‌شوند.",
  "Create your first goal above.": "نخستین هدف خود را در بالا بسازید.", "Create your first habit and start building consistency.": "نخستین عادت خود را بسازید و استمرار را آغاز کنید.",
  "Create your first task": "نخستین کار خود را بسازید", "Create your first task and start executing.": "نخستین کار خود را ایجاد و اجرا را آغاز کنید.",
  "Create Goal": "ایجاد هدف", "Create a goal": "ایجاد یک هدف", "Create one": "ایجاد مورد جدید",
  "Creating account...": "در حال ساخت حساب...", "Creating...": "در حال ایجاد...", "Loading goals...": "در حال بارگذاری هدف‌ها...",
  "Loading habits...": "در حال بارگذاری عادت‌ها...", "Loading tasks...": "در حال بارگذاری کارها...", "Loading transactions": "در حال بارگذاری تراکنش‌ها",
  "Loading your books": "در حال بارگذاری کتاب‌ها", "Loading your dashboard…": "در حال بارگذاری داشبورد…", "Loading your entries…": "در حال بارگذاری یادداشت‌ها…",
  "Loading your plans…": "در حال بارگذاری برنامه‌ها…", "Longest streak:": "بیشترین تداوم:", "Current streak:": "تداوم فعلی:",
  "Make time for your next chapter": "برای فصل بعدی خود وقت بگذارید", "Money received": "پول دریافتی", "Money spent": "پول مصرف‌شده",
  "Daily habit completion this week": "تکمیل عادت‌های روزانه در این هفته", "Progress across active goals": "پیشرفت هدف‌های فعال",
  "Daily overview": "نمای کلی روزانه", "Mood check-in": "ثبت حال‌وهوای امروز", "Recent completions": "تکمیل‌های اخیر",
  "Your activity snapshot for today": "خلاصه فعالیت‌های امروز شما", "Your progress across today’s priorities": "پیشرفت شما در اولویت‌های امروز",
  "Your activity starts here": "فعالیت شما از این‌جا آغاز می‌شود", "Your daily habit activity will build this weekly view.": "فعالیت روزانه عادت‌های شما این نمای هفتگی را می‌سازد.",
  "You have overdue tasks. Open Tasks to review them.": "کارهای عقب‌افتاده دارید. برای بررسی، بخش کارها را باز کنید.",
  "Nothing is due today.": "امروز موردی سررسید نمی‌شود.", "Due today": "سررسید امروز", "Due": "سررسید",
  "Edit goal": "ویرایش هدف", "Delete goal": "حذف هدف", "Started:": "آغاز:", "Target:": "هدف:",
  "Completed today": "امروز تکمیل‌شده", "Completions:": "دفعات تکمیل:", "Completed:": "تکمیل‌شده:", "Done": "انجام‌شده",
  "New habit": "عادت جدید", "Pause": "توقف موقت", "Paused": "متوقف‌شده", "Resume": "ادامه",
  "Every day": "هر روز", "Once per week": "هفته‌ای یک‌بار",
  "Learning planner": "برنامه‌ریز یادگیری", "Learning plans": "برنامه‌های یادگیری",
  "Reading progress": "پیشرفت مطالعه", "pages per study day": "صفحه در هر روز مطالعه", "pages this month": "صفحه در این ماه",
  "pages this week": "صفحه در این هفته", "pages · target": "صفحه · هدف", "Target finish date": "تاریخ پایان هدف",
  "Update your study plan": "برنامه درسی خود را به‌روز کنید", "Study sessions, finish dates, and page targets for each book.": "جلسه‌های مطالعه، تاریخ پایان و هدف تعداد صفحه برای هر کتاب.",
  "No active reading plans.": "برنامه مطالعه فعالی ندارید.", "No entries match that search.": "یادداشتی با این جستجو پیدا نشد.",
  "Search journal history": "جستجو در تاریخچه یادداشت‌ها", "Search your journal history…": "در تاریخچه یادداشت‌ها جستجو کنید…",
  "Close history search": "بستن جستجوی تاریخچه", "Close journal entry": "بستن یادداشت روزانه", "Private journal entry": "یادداشت خصوصی روزانه",
  "Only you can see entries saved to your account.": "فقط شما می‌توانید یادداشت‌های ذخیره‌شده در حساب‌تان را ببینید.",
  "Your private reflections, saved by date.": "یادداشت‌های خصوصی شما که بر اساس تاریخ ذخیره شده‌اند.", "Your saved reflections will appear here.": "یادداشت‌های ذخیره‌شده شما این‌جا نمایش داده می‌شوند.",
  "Today’s entry is saved. You can update it anytime today.": "یادداشت امروز ذخیره شد. می‌توانید آن را در هر زمان از امروز به‌روز کنید.", "Today’s reflection": "بازنگری امروز",
  "Write a few thoughts…": "چند جمله بنویسید…", "3 prompts": "۳ پرسش", "Update journal": "به‌روزرسانی یادداشت", "Saved": "ذخیره شد",
  "Enter to send · Shift + Enter for a new line": "برای ارسال Enter را بزنید · برای خط جدید Shift + Enter",
  "Discipline Assistant": "دستیار دیسیپلین", "Uses your tasks, goals, habits, and study plans": "از کارها، هدف‌ها، عادت‌ها و برنامه‌های درسی شما استفاده می‌کند",
  "Private data loaded from your account": "اطلاعات خصوصی از حساب شما بارگذاری شد", "Pick one priority, finish a focused work block, then come back for the next step.": "یک اولویت را انتخاب کنید، با تمرکز انجامش دهید و برای گام بعدی برگردید.",
  "You don’t need a perfect day. Notice what happened, take one lesson with you, and begin again.": "لازم نیست روزتان بی‌نقص باشد. به آنچه گذشت توجه کنید، یک درس بگیرید و دوباره شروع کنید.",
  "YOUR MONEY, IN FOCUS": "نمای روشن امور مالی شما", "Income this month": "درآمد این ماه", "Expenses this month": "مصارف این ماه",
  "Your expenses compared with income in": "مصارف شما در مقایسه با درآمد در", "of income spent": "از درآمد مصرف‌شده", "· after expenses": "· پس از مصارف",
  "Try another search or switch the activity filter.": "جستجوی دیگری انجام دهید یا فیلتر فعالیت را تغییر دهید.", "No matching transactions": "تراکنش مطابق پیدا نشد",
  "All activity": "همه فعالیت‌ها", "Open alerts": "بازکردن اعلان‌ها", "Open profile settings": "بازکردن تنظیمات پروفایل",
  "Start a streak today": "امروز تداوم را آغاز کنید", "KEEP MAKING PROGRESS": "به پیشرفت ادامه دهید", "Personal operating system": "سامانه شخصی پیشرفت",
  "Good": "خوب", "IN": "درآمد", "OUT": "مصرف", "Today's rate": "امتیاز امروز", "· Discipline score": "· امتیاز نظم",
  "You’re all caught up.": "همه اعلان‌ها را بررسی کرده‌اید.", "Not saved": "ذخیره نشده", "Not saved yet": "هنوز ذخیره نشده",
  "Saved reminders for your account": "یادآوری‌های ذخیره‌شده برای حساب شما", "Shorter months use their last calendar day.": "در ماه‌های کوتاه، از آخرین روز همان ماه استفاده می‌شود.",
  "Sign in to continue.": "برای ادامه وارد شوید.",
  "Signing in...": "در حال ورود...", "Full name": "نام کامل", "Start building your personal operating system.": "ساخت سامانه شخصی خود را برای پیشرفت آغاز کنید.",
  "Back to your overview": "بازگشت به نمای کلی", "Add a book": "افزودن کتاب", "Close form": "بستن فرم", "Close study plan form": "بستن فرم برنامه درسی",
  "Dismiss error": "بستن پیام خطا", "Choose a book and finish date.": "کتاب و تاریخ پایان را انتخاب کنید.", "a week": "یک هفته", "day": "روز", "days": "روز", "week": "هفته", "month": "ماه",
  "today": "امروز", "morning": "صبح", "afternoon": "بعدازظهر", "evening": "عصر", "short": "کوتاه", "daily": "روزانه", "weekly": "هفتگی", "monthly": "ماهانه", "active": "فعال", "completed": "تکمیل‌شده", "expense": "مصرف", "income": "درآمد", "habit": "عادت", "habits": "عادت‌ها", "goals completed": "هدف تکمیل شد", "expense entries": "ثبت‌های مصرف", "income entries": "ثبت‌های درآمد",

  "Preferences": "ترجیحات", "Manage your account and Discipline experience.": "حساب کاربری و تجربه استفاده از دیسیپلین را مدیریت کنید.",
  "Unsaved changes": "تغییرات ذخیره‌نشده", "Loading your settings…": "تنظیمات شما بارگذاری می‌شود…",
  "Loading…": "در حال بارگذاری…", "Save changes": "ذخیره تغییرات", "Saving…": "در حال ذخیره…",
  "You have changes to save.": "تغییراتی برای ذخیره دارید.", "Your preferences are up to date.": "ترجیحات شما به‌روز است.",
  "Your settings are saved to your account.": "تنظیمات شما در حساب‌تان ذخیره شد.", "Appearance": "نمایش",
  "Tune the look and navigation density of your workspace.": "ظاهر و چیدمان فضای کاری خود را تنظیم کنید.",
  "Language": "زبان", "Choose the language used throughout the app.": "زبان مورد استفاده در سراسر برنامه را انتخاب کنید.",
  "English": "English (انگلیسی)", "Persian (فارسی)": "فارسی (دری)", "فارسی": "فارسی",
  "Theme": "زمینه", "Dark": "تاریک", "Light": "روشن", "System": "مطابق سیستم", "Accent color": "رنگ تأکیدی",
  "Used for highlights and primary actions.": "برای بخش‌های برجسته و دکمه‌های اصلی استفاده می‌شود.",
  "Compact sidebar": "نوار کناری فشرده", "Use an icon-only sidebar to leave more room for your pages.": "برای فضای بیشتر، نوار کناری را فقط به شکل آیکون نمایش بده.",
  "Account": "حساب کاربری", "Your profile details and sign-in credentials.": "مشخصات پروفایل و اطلاعات ورود شما.",
  "Change photo": "تغییر عکس", "Remove photo": "حذف عکس", "Your profile": "پروفایل شما", "Name": "نام", "Email": "ایمیل",
  "Password": "رمز عبور", "Update the password used to sign in.": "رمز عبور ورود به حساب را تغییر دهید.", "Change password": "تغییر رمز عبور",
  "Choose which reminders are saved for your account and shown throughout the app.": "اعلان‌هایی را که برای حساب شما ذخیره و در برنامه نمایش داده می‌شوند انتخاب کنید.",
  "Task alerts": "اعلان‌های کارها", "Upcoming, due, and overdue task reminders.": "یادآوری کارهای پیش‌رو، سررسیدشده و عقب‌افتاده.",
  "Habit alerts": "اعلان‌های عادت‌ها", "Scheduled reminders, missed periods, and active streak reminders.": "یادآوری‌های زمان‌بندی‌شده، دوره‌های ازدست‌رفته و تداوم عادت‌ها.",
  "Goal alerts": "اعلان‌های هدف‌ها", "Upcoming, due, overdue, and completed goal reminders.": "یادآوری هدف‌های پیش‌رو، سررسیدشده، عقب‌افتاده و تکمیل‌شده.",
  "Daily discipline reminder": "یادآوری نظم روزانه", "Check your target at the reminder time below.": "در زمان یادآوری زیر، هدف روزانه خود را بررسی کنید.",
  "Evening journal reminder": "یادآوری یادداشت شبانه", "Remind you when today’s private entry is still empty.": "اگر یادداشت خصوصی امروز خالی باشد، به شما یادآوری می‌کند.",
  "Notification sound": "صدای اعلان", "Choose the sound played by scheduled phone reminders.": "صدای یادآوری‌های زمان‌بندی‌شده در تلفن را انتخاب کنید.",
  "Discipline alarm chime": "صدای زنگ دیسیپلین", "Phone system sound": "صدای اعلان تلفن", "Test sound": "آزمایش صدا",
  "A sound-test notification is scheduled to arrive in about two seconds.": "اعلان آزمایشی صدا تا دو ثانیه دیگر می‌رسد.",
  "Android’s notification-channel and Do Not Disturb settings can override the selected sound or volume.": "تنظیمات کانال اعلان و مزاحم‌نشدن اندروید می‌تواند صدا یا بلندی انتخاب‌شده را تغییر دهد.",
  "Test AI connection": "آزمایش اتصال هوش مصنوعی", "Testing…": "در حال آزمایش…",
  "Provider keys belong in the server environment. They are never stored in this app or exposed to your phone.": "کلیدهای ارائه‌دهنده باید در محیط سرور باشند؛ این برنامه آن‌ها را ذخیره یا به تلفن شما ارسال نمی‌کند.",
  "Enable Android notifications": "فعال‌کردن اعلان‌های اندروید", "Enabling…": "در حال فعال‌سازی…",
  "The server checks deadlines once a minute and saves each alert once. Install the Android app and allow notifications in Settings to receive scheduled device alerts. Android may ask for Alarms & reminders access to improve timing accuracy.": "سرور هر دقیقه مهلت‌ها را بررسی می‌کند و هر اعلان را یک‌بار ثبت می‌کند. برای دریافت اعلان‌های زمان‌بندی‌شده، برنامه اندروید را نصب کنید و اعلان‌ها را در تنظیمات فعال سازید. برای دقیق‌ترشدن زمان‌بندی، ممکن است اندروید دسترسی «زنگ‌ها و یادآوری‌ها» را درخواست کند.",
  "Daily discipline": "نظم روزانه", "Set the daily target and when your check-in reminders appear.": "هدف روزانه و زمان یادآوری بررسی پیشرفت را تعیین کنید.",
  "Daily reminder time": "زمان یادآوری روزانه", "Daily discipline goal": "هدف نظم روزانه",
  "Your target is a score from 0 to 100 percent.": "هدف شما امتیازی بین صفر تا صد درصد است.",
  "Streak reminders": "یادآوری تداوم", "Show a reminder if no daily habit is complete by your reminder time.": "اگر تا زمان یادآوری هیچ عادت روزانه‌ای تکمیل نشده باشد، یادآوری نمایش بده.",
  "Set a starting mood and keep your reflections private.": "حال‌وهوای پیش‌فرض را انتخاب کنید و یادداشت‌ها را خصوصی نگه دارید.",
  "Default mood": "حال‌وهوای پیش‌فرض", "No default": "بدون پیش‌فرض", "Private by default": "به‌طور پیش‌فرض خصوصی",
  "Journal entries are visible only to your account. Sharing is not enabled.": "یادداشت‌های روزانه فقط برای حساب شما قابل مشاهده است و اشتراک‌گذاری فعال نیست.",
  "Finance": "امور مالی", "Choose the currency and set an optional monthly expense threshold.": "واحد پول را انتخاب کنید و در صورت نیاز سقف ماهانه مصارف را تعیین کنید.",
  "Currency": "واحد پول", "AFN · Afghan Afghani": "AFN · افغانی افغانستان", "Monthly spending alerts": "اعلان مصارف ماهانه",
  "AFN is the currency currently supported by finance entries.": "در حال حاضر، بخش امور مالی از واحد پول افغانی پشتیبانی می‌کند.",
  "Show an alert when expenses reach your limit.": "وقتی مصارف به سقف تعیین‌شده رسید، اعلان بده.", "Monthly spending limit (AFN)": "سقف مصارف ماهانه (افغانی)",
  "Privacy & security": "حریم خصوصی و امنیت", "Control access to your account and keep a copy of your information.": "دسترسی به حساب را مدیریت کنید و یک نسخه از اطلاعات خود داشته باشید.",
  "Two-factor authentication": "احراز هویت دومرحله‌ای", "Extra sign-in protection is not available yet.": "محافظت اضافی هنگام ورود هنوز در دسترس نیست.",
  "Not enabled": "فعال نیست", "Active session": "نشست فعال", "This browser": "این مرورگر", "Sign out": "خروج",
  "Download my data": "دریافت اطلاعات من", "Export your profile, settings, and app records as JSON.": "پروفایل، تنظیمات و اطلاعات برنامه را به‌صورت JSON دریافت کنید.",
  "Export data": "دریافت اطلاعات", "Preparing…": "در حال آماده‌سازی…", "Session management across multiple devices is not available yet; you can end this browser session here.": "مدیریت نشست در چند دستگاه هنوز در دسترس نیست؛ می‌توانید نشست این مرورگر را در همین‌جا پایان دهید.",
  "About Discipline": "درباره دیسیپلین", "A personal operating system for steady progress.": "سامانه‌ای شخصی برای پیشرفت پیوسته.",
  "Created by Salahuddin Forotan": "ساخته‌شده توسط MR Salahuddin Forotan", "Danger zone": "بخش خطرناک",
  "Delete your account and permanently remove its tasks, goals, habits, finance records, learning plans, and journal entries.": "حساب خود را حذف کنید تا کارها، هدف‌ها، عادت‌ها، سوابق مالی، برنامه‌های یادگیری و یادداشت‌ها برای همیشه پاک شوند.",
  "Delete account": "حذف حساب", "Delete all my data": "حذف همه اطلاعات من", "Cancel": "لغو", "Update password": "به‌روزرسانی رمز عبور",
  "Current password": "رمز عبور فعلی", "New password": "رمز عبور جدید", "At least 8 characters": "حداقل ۸ نویسه",
  "Enter your current password to continue.": "برای ادامه، رمز عبور فعلی خود را وارد کنید.",
  "Type DELETE exactly, using capital letters, to confirm.": "برای تأیید، دقیقاً DELETE را با حروف بزرگ بنویسید.",
  "Type DELETE in capital letters. Use your current sign-in password above.": "DELETE را با حروف بزرگ بنویسید و رمز عبور فعلی ورود خود را در بالا وارد کنید.",
  "Deleting account…": "در حال حذف حساب…", "Current password is incorrect.": "رمز عبور فعلی نادرست است.",
  "Verify your current password to continue.": "برای ادامه، رمز عبور فعلی را تأیید کنید.", "Permanently delete account?": "حساب برای همیشه حذف شود؟",
  "This cannot be undone. All of your Discipline data will be deleted. Enter your password and type": "این کار بازگشت‌پذیر نیست. همه اطلاعات شما در دیسیپلین حذف خواهد شد. رمز عبور خود را وارد کنید و بنویسید",
  "Type DELETE to confirm": "برای تأیید DELETE را بنویسید", "Close password dialog": "بستن پنجره رمز عبور", "Close delete account dialog": "بستن پنجره حذف حساب",

  "Welcome back": "خوش آمدید", "Sign in to continue": "برای ادامه وارد شوید", "Sign in": "ورود", "Signing in…": "در حال ورود…",
  "Create account": "ساخت حساب", "Create your account": "حساب خود را بسازید", "Register": "ثبت‌نام", "Your name": "نام شما",
  "Your password": "رمز عبور شما", "you@example.com": "you@example.com", "Already have an account?": "از قبل حساب دارید؟",
  "Don’t have an account?": "حساب ندارید؟", "Forgot password?": "رمز عبور را فراموش کرده‌اید؟", "Continue": "ادامه",

  "Execution": "اجرا", "Plan your work and follow through.": "کارهای خود را برنامه‌ریزی و پیگیری کنید.",
  "Add task": "افزودن کار", "Add a task": "افزودن کار", "New task": "کار جدید", "Create task": "ایجاد کار", "Save task": "ذخیره کار",
  "Edit task": "ویرایش کار", "Delete task": "حذف کار", "Task title": "عنوان کار", "Description": "توضیحات",
  "Due date": "تاریخ سررسید", "Due time": "زمان سررسید", "Optional details...": "توضیحات اختیاری...",
  "Optional description": "توضیحات اختیاری", "Completed": "تکمیل‌شده", "Remaining": "باقی‌مانده", "Total": "مجموع",
  "No tasks yet": "هنوز کاری اضافه نشده است", "No tasks yet.": "هنوز کاری اضافه نشده است.", "All tasks": "همه کارها",
  "Today": "امروز", "Overdue": "عقب‌افتاده", "Upcoming": "پیش‌رو", "Mark complete": "علامت‌گذاری به‌عنوان تکمیل‌شده",
  "e.g. Finish project proposal": "مثلاً تکمیل پیشنهاد پروژه", "Save": "ذخیره", "Delete": "حذف", "Edit": "ویرایش", "Close": "بستن",

  "Build meaningful goals and make steady progress.": "هدف‌های معنادار بسازید و پیوسته پیشرفت کنید.",
  "Add goal": "افزودن هدف", "Create goal": "ایجاد هدف", "Update goal": "به‌روزرسانی هدف", "Goal title": "عنوان هدف",
  "Goal name": "نام هدف", "Start date": "تاریخ آغاز", "Target date": "تاریخ هدف", "Target completion date": "تاریخ تکمیل هدف",
  "Target completion time": "زمان تکمیل هدف", "Progress": "پیشرفت", "Active goals": "هدف‌های فعال", "Completed goals": "هدف‌های تکمیل‌شده",
  "No goals yet": "هنوز هدفی اضافه نشده است", "No active goals": "هدف فعالی ندارید",
  "Description (optional)": "توضیحات (اختیاری)", "Goal completed": "هدف تکمیل شد", "Complete goal": "تکمیل هدف",

  "Build consistency one day at a time.": "هر روز با ثبات بیشتر عادت بسازید.",
  "Add habit": "افزودن عادت", "Add New Habit": "افزودن عادت جدید", "Create habit": "ایجاد عادت", "Update habit": "به‌روزرسانی عادت",
  "Habit name": "نام عادت", "Frequency": "تکرار", "Daily": "روزانه", "Weekly": "هفتگی", "Monthly": "ماهانه",
  "Reminder time": "زمان یادآوری", "Day of month": "روز ماه", "Current streak": "تداوم فعلی", "Longest streak": "بیشترین تداوم",
  "No habits yet": "هنوز عادتی اضافه نشده است", "Complete today": "تکمیل امروز", "Mark done": "علامت‌گذاری به‌عنوان انجام‌شده",
  "e.g. Exercise": "مثلاً ورزش", "Active": "فعال", "Inactive": "غیرفعال",

  "Track your money and understand your cash flow.": "پول خود را ثبت کنید و جریان مالی‌تان را بشناسید.",
  "Net balance": "تراز خالص", "Transactions": "تراکنش‌ها", "Add income": "افزودن درآمد",
  "Add expense": "افزودن مصرف", "Add transaction": "افزودن تراکنش", "Monthly cash flow": "جریان مالی ماهانه",
  "Monthly Reports": "گزارش ماهانه", "All months": "همه ماه‌ها", "Loading reports": "در حال بارگذاری گزارش‌ها",
  "Your saved activity grouped by Solar Hijri month": "فعالیت‌های ذخیره‌شده بر اساس ماه هجری خورشیدی",
  "Income, expenses, and transactions for this month": "درآمد، مصارف و تراکنش‌های این ماه",
  "Total income": "کل درآمد", "Total expenses": "کل مصارف", "Income minus expenses": "درآمد پس از کسر مصارف",
  "No transactions for this month": "در این ماه تراکنشی نیست",
  "This month has no saved income or expenses.": "برای این ماه درآمد یا مصرفی ثبت نشده است.",
  "No monthly reports yet": "هنوز گزارشی ماهانه وجود ندارد",
  "Saved income and expense records will appear here.": "درآمدها و مصارف ثبت‌شده اینجا نمایش داده می‌شوند.",
  "Solar Hijri date:": "تاریخ هجری خورشیدی:", "dates shown in the Afghan Solar Hijri calendar": "تاریخ‌ها بر اساس تقویم هجری خورشیدی افغانستان",
  "income transactions": "تراکنش‌های درآمد", "expense transactions": "تراکنش‌های مصرف",
  "entry": "ثبت", "entries": "ثبت‌ها", "records": "ثبت‌ها",
  "Financial overview": "نمای کلی مالی", "This month": "این ماه", "Salary": "معاش", "Expense": "مصرف",
  "Income entry": "ثبت درآمد", "Expense entry": "ثبت مصرف", "Title": "عنوان", "Category": "دسته‌بندی", "Amount": "مبلغ",
  "Date": "تاریخ", "Notes": "یادداشت‌ها", "Add a short note": "یادداشت کوتاهی بنویسید", "No transactions yet": "هنوز تراکنشی ثبت نشده است",
  "e.g. Monthly salary": "مثلاً معاش ماهانه", "e.g. Apartment rent": "مثلاً کرایه خانه", "Delete transaction": "حذف تراکنش",
  "View income and expenses": "نمایش درآمد و مصارف", "All transactions": "همه تراکنش‌ها", "Net": "خالص",

  "Learn with a clear plan and track your progress.": "با برنامه‌ای روشن یاد بگیرید و پیشرفت خود را پیگیری کنید.",
  "Plan a book": "برنامه‌ریزی برای کتاب", "Add book": "افزودن کتاب", "Update plan": "به‌روزرسانی برنامه", "Create study plan": "ایجاد برنامه درسی",
  "Book title": "عنوان کتاب", "Author": "نویسنده", "Author name": "نام نویسنده", "Total pages": "مجموع صفحه‌ها",
  "Pages already read": "صفحه‌های خوانده‌شده", "Current page": "صفحه فعلی", "pages": "صفحه", "Study days per week": "روزهای مطالعه در هفته",
  "Study from": "زمان آغاز مطالعه", "Study until": "زمان پایان مطالعه", "Start studying": "آغاز مطالعه", "Finish by": "پایان تا",
  "Daily target": "هدف روزانه", "Weekly target": "هدف هفتگی", "Monthly target": "هدف ماهانه", "pages per day": "صفحه در روز",
  "pages per week": "صفحه در هفته", "pages per month": "صفحه در ماه", "No active plans": "برنامه فعالی وجود ندارد",
  "No study plans yet": "هنوز برنامه درسی ندارید", "In progress": "در حال انجام", "Finished": "تکمیل‌شده", "Past target date": "تاریخ هدف گذشته است",
  "Update progress": "به‌روزرسانی پیشرفت", "Add reading progress": "ثبت پیشرفت مطالعه", "e.g. Deep Work": "مثلاً کار عمیق",

  "Write. Reflect. Improve.": "بنویسید. بیندیشید. بهتر شوید.", "How are you feeling today?": "امروز چه احساسی دارید؟",
  "Today's Reflection": "یادداشت امروز", "Today’s Reflection": "یادداشت امروز", "What did I accomplish today?": "امروز چه کارهایی انجام دادم؟",
  "What could I have done better?": "چه چیزی را می‌توانستم بهتر انجام بدهم؟", "What am I grateful for?": "برای چه چیزی سپاسگزارم؟",
  "Save Journal": "ذخیره یادداشت", "Save journal": "ذخیره یادداشت", "Journal history": "تاریخچه یادداشت‌ها",
  "No journal entries yet": "هنوز یادداشتی ثبت نشده است", "Morning plan": "برنامه صبحگاهی", "Evening reflection": "بازنگری شبانه",
  "What will I focus on today?": "امروز روی چه چیزی تمرکز می‌کنم؟", "What did I learn?": "چه چیزی یاد گرفتم؟", "What will I do differently tomorrow?": "فردا چه چیزی را متفاوت انجام می‌دهم؟",
  "Great day": "روز عالی", "Productive": "پربازده", "Difficult": "دشوار",
  "Strong discipline": "نظم عالی", "Mood": "حال‌وهوا", "Reflection": "بازنگری", "Grateful for": "سپاسگزارم برای",
  "😊 Happy": "😊 خوشحال", "😌 Calm": "😌 آرام", "😐 Neutral": "😐 معمولی", "😔 Low": "😔 گرفته",
  "😤 Frustrated": "😤 ناراحت", "🔥 Motivated": "🔥 باانگیزه", "Happy": "خوشحال", "Calm": "آرام",
  "Neutral": "معمولی", "Low": "گرفته", "Frustrated": "ناراحت", "Motivated": "باانگیزه",

  "PRIVATE PRODUCTIVITY COACH": "مربی خصوصی بهره‌وری", "Planning mode": "حالت برنامه‌ریزی", "Your planning context": "اطلاعات برنامه‌ریزی شما",
  "Ask the assistant": "از دستیار بپرسید", "Send message": "ارسال پیام", "Ask about your day, goals, habits, or study plan…": "درباره روز، هدف‌ها، عادت‌ها یا برنامه درسی خود بپرسید…",
  "Plan my day": "برنامه‌ریزی روز من", "Clear conversation": "پاک‌کردن گفتگو", "Assistant": "دستیار", "You": "شما",

  "Yes": "بله", "No": "خیر", "Create": "ایجاد", "Update": "به‌روزرسانی", "Add": "افزودن", "View all": "نمایش همه",
  "No results found": "نتیجه‌ای پیدا نشد", "No matching items found.": "مورد مطابق پیدا نشد.", "No matching items": "مورد مطابق پیدا نشد",
  "Loading": "در حال بارگذاری", "Error": "خطا", "Try again": "دوباره تلاش کنید", "Today’s schedule": "برنامه امروز",
  "Upcoming deadlines": "مهلت‌های پیش‌رو", "Weekly discipline": "نظم هفتگی", "This week": "این هفته", "Tasks complete": "کارهای تکمیل‌شده",
  "Habit consistency": "پایبندی به عادت‌ها", "Active goal progress": "پیشرفت هدف‌های فعال", "What matters today": "اولویت‌های امروز",
  "No tasks due today": "امروز کاری سررسید نمی‌شود", "No overdue tasks": "کار عقب‌افتاده‌ای ندارید",
  "Bank Accounts": "حساب‌های بانکی", "Connect Bank Account": "اتصال حساب بانکی", "Connect Azizi Bank": "اتصال بانک عزیزی",
  "Connected accounts": "حساب‌های متصل", "No bank accounts connected": "هیچ حساب بانکی متصل نیست",
  "Import Bank Statement": "واردکردن صورت‌حساب بانکی", "Import statement": "واردکردن صورت‌حساب", "View Transactions": "نمایش تراکنش‌ها",
  "Sync Now": "همگام‌سازی اکنون", "Last synchronized": "آخرین همگام‌سازی", "Last statement import": "آخرین واردکردن صورت‌حساب",
  "Statement imports only": "فقط واردکردن صورت‌حساب", "Not synchronized": "همگام‌سازی نشده", "Not available": "در دسترس نیست",
  "Import Preview": "پیش‌نمایش واردکردن", "Import Selected": "واردکردن موارد انتخاب‌شده", "Choose CSV file": "انتخاب فایل CSV",
  "Account name": "نام حساب", "Last four digits (optional)": "چهار رقم پایانی (اختیاری)", "Balance": "موجودی",
  "Authorized API / Integration": "API یا اتصال مجاز", "Connection method": "روش اتصال", "Direct synchronization is currently unavailable. You can import an authorized bank statement instead.": "همگام‌سازی مستقیم فعلاً در دسترس نیست. می‌توانید صورت‌حساب بانکی مجاز را وارد کنید.",
  "Azizi Bank API integration is not configured yet.": "اتصال API بانک عزیزی هنوز پیکربندی نشده است.",
  "Discipline App will never ask you to provide your AziPay MPIN, OTP, card PIN, or banking password.": "برنامه دیسیپلین هرگز رمز AziPay، MPIN، رمز یک‌بارمصرف، رمز کارت یا گذرواژه بانکی شما را نمی‌خواهد.",
  "Disconnect Azizi Bank?": "قطع اتصال بانک عزیزی؟", "Previously imported transactions will remain in your Discipline App unless you explicitly delete them.": "تراکنش‌های واردشده قبلی در برنامه باقی می‌مانند، مگر این‌که خودتان آن‌ها را حذف کنید.",
  "Statement files are processed for preview and are not saved.": "فایل صورت‌حساب فقط برای پیش‌نمایش پردازش می‌شود و ذخیره نمی‌شود.",
  "Bank account data permissions": "مجوزهای داده حساب بانکی", "How statement-imported bank records are used and retained.": "نحوه استفاده و نگهداری سوابق واردشده از صورت‌حساب بانکی.",
  "Imported transactions are available only in your account’s Bank Accounts, Income & Expenses, and monthly reports.": "تراکنش‌های واردشده فقط در حساب، بخش درآمد و مصارف و گزارش‌های ماهانه شما قابل مشاهده‌اند.",
  "Statement files are parsed for preview and are not kept. Transaction reference values are stored only as one-way hashes.": "فایل صورت‌حساب فقط برای پیش‌نمایش پردازش می‌شود و نگهداری نمی‌شود. شماره‌های مرجع تراکنش فقط به‌صورت هش یک‌طرفه ذخیره می‌شوند.",
  "Disconnecting stops synchronization and keeps previously imported finance records. Statement import does not make payments or transfers.": "قطع اتصال همگام‌سازی را متوقف می‌کند و سوابق مالی واردشده را نگه می‌دارد. واردکردن صورت‌حساب هیچ پرداخت یا انتقالی انجام نمی‌دهد.",
  "Unavailable from statement": "از صورت‌حساب در دسترس نیست", "Manage Bank Accounts": "مدیریت حساب‌های بانکی",
};

const translatedText = new WeakMap<Text, TranslationState>();
const translatedAttributes = new WeakMap<Element, Map<string, TranslationState>>();
let currentLanguage: LanguagePreference = "en";
let observer: MutationObserver | undefined;

function normalize(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function translatePhrase(source: string): string {
  const phrase = normalize(source);
  const exact = persian[phrase];
  if (exact) return exact;
  let match = phrase.match(/^(\d+) unread$/i);
  if (match) return `${match[1]} خوانده‌نشده`;
  match = phrase.match(/^Notifications, (\d+) unread$/i);
  if (match) return `اعلان‌ها، ${match[1]} خوانده‌نشده`;
  match = phrase.match(/^This month · (.+) net$/i);
  if (match) return `این ماه · ${match[1]} خالص`;
  match = phrase.match(/^(\d+) pages?$/i);
  if (match) return `${match[1]} صفحه`;
  match = phrase.match(/^Delete (.+)$/i);
  if (match) return `حذف ${match[1]}`;
  match = phrase.match(/^Edit (.+)$/i);
  if (match) return `ویرایش ${match[1]}`;
  match = phrase.match(/^View (.+)$/i);
  if (match) return `نمایش ${match[1]}`;
  return source;
}

function translateText(node: Text) {
  const visible = node.data;
  if (!normalize(visible)) return;
  let state = translatedText.get(node);
  if (!state) {
    state = { source: visible, rendered: visible };
    translatedText.set(node, state);
  } else if (visible !== state.rendered) {
    // React reused this text node for a new label; retain the new English source.
    state.source = visible;
  }
  const next = currentLanguage === "fa" ? translatePhrase(state.source) : state.source;
  state.rendered = next;
  if (visible !== next) node.data = next;
}

const translatedAttributeNames = ["aria-label", "aria-description", "title", "placeholder", "alt"];

function translateAttributes(element: Element) {
  if (element.closest("[data-no-translate], [contenteditable='true']")) return;
  let states = translatedAttributes.get(element);
  if (!states) {
    states = new Map();
    translatedAttributes.set(element, states);
  }
  for (const name of translatedAttributeNames) {
    if (!element.hasAttribute(name)) continue;
    const visible = element.getAttribute(name) ?? "";
    let state = states.get(name);
    if (!state) {
      state = { source: visible, rendered: visible };
      states.set(name, state);
    } else if (visible !== state.rendered) {
      state.source = visible;
    }
    const next = currentLanguage === "fa" ? translatePhrase(state.source) : state.source;
    state.rendered = next;
    if (visible !== next) element.setAttribute(name, next);
  }
}

function translateTree(root: Node) {
  if (root.nodeType === Node.TEXT_NODE) {
    const parent = root.parentElement;
    if (parent && !parent.closest("script, style, noscript, [data-no-translate], [contenteditable='true']")) {
      translateText(root as Text);
    }
    return;
  }
  if (!(root instanceof Element || root instanceof Document || root instanceof DocumentFragment)) return;
  if (root instanceof Element && root.closest("[data-no-translate], [contenteditable='true']")) return;
  if (root instanceof Element) translateAttributes(root);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let textNode: Node | null;
  while ((textNode = walker.nextNode())) {
    const parent = textNode.parentElement;
    if (parent && !parent.closest("script, style, noscript, [data-no-translate], [contenteditable='true']")) translateText(textNode as Text);
  }
  if (root instanceof Element) {
    if (root.matches(translatedAttributeNames.map((name) => `[${name}]`).join(","))) translateAttributes(root);
    root.querySelectorAll(translatedAttributeNames.map((name) => `[${name}]`).join(",")).forEach(translateAttributes);
  }
}

export function applyLanguage(language: LanguagePreference) {
  currentLanguage = language === "fa" ? "fa" : "en";
  if (typeof document === "undefined") return;
  document.documentElement.lang = currentLanguage === "fa" ? "fa-AF" : "en";
  document.documentElement.dir = currentLanguage === "fa" ? "rtl" : "ltr";
  document.documentElement.dataset.language = currentLanguage;
  window.dispatchEvent(new Event("discipline:language-updated"));
  if (observer) translateTree(document.documentElement);
}

export function getLanguage(): LanguagePreference {
  return currentLanguage;
}

export function getAppLocale(): string {
  return currentLanguage === "fa" ? "fa-AF" : "en-US";
}

export function initializeLanguageTranslations() {
  if (typeof document === "undefined" || observer) return;
  observer = new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === "characterData" && record.target instanceof Text) translateText(record.target);
      for (const node of record.addedNodes) translateTree(node);
      if (record.type === "attributes" && record.target instanceof Element) translateAttributes(record.target);
    }
  });
  observer.observe(document.documentElement, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: translatedAttributeNames,
  });
  translateTree(document.documentElement);
}
