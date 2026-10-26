import creatorPhoto from "../../assets/creator-photo.png";

type CreatorBrandProps = {
  className?: string;
};

export default function CreatorBrand({ className = "" }: CreatorBrandProps) {
  return (
    <div className={`flex min-w-0 items-center gap-3 ${className}`}>
      <img
        src={creatorPhoto}
        alt="MR Salahuddin Forotan"
        className="h-11 w-11 shrink-0 rounded-full object-cover ring-2 ring-white/10 sm:h-12 sm:w-12"
        style={{ objectPosition: "50% 32%" }}
      />
      <div className="min-w-0">
        <p className="truncate text-xs font-bold tracking-[0.14em] text-white sm:text-sm">
          DISCIPLINE
        </p>
        <p className="mt-0.5 text-[10px] leading-4 text-slate-400 sm:text-xs">
          Created by MR Salahuddin Forotan
        </p>
      </div>
    </div>
  );
}
