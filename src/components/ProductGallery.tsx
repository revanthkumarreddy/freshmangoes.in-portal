import { useState } from 'react';

type Props = {
  images: string[];
  alt: string;
};

export default function ProductGallery({ images, alt }: Props) {
  const gallery = images.length ? images : [];
  const [active, setActive] = useState(0);
  const main = gallery[active] || gallery[0];

  if (!main) return null;

  return (
    <div>
      <div className="aspect-[4/5] overflow-hidden bg-[color:var(--color-saffron-100)]">
        <img src={main} alt={alt} className="w-full h-full object-cover" />
      </div>
      {gallery.length > 1 && (
        <div className="mt-3 grid grid-cols-5 gap-2">
          {gallery.slice(0, 5).map((g, i) => (
            <button
              key={g + i}
              type="button"
              onClick={() => setActive(i)}
              aria-label={`View image ${i + 1}`}
              className={
                'aspect-square overflow-hidden bg-[color:var(--color-saffron-100)] border-2 transition-colors ' +
                (i === active ? 'border-[color:var(--color-leaf-600)]' : 'border-transparent hover:border-black/20')
              }
            >
              <img src={g} alt="" className="w-full h-full object-cover" loading="lazy" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
