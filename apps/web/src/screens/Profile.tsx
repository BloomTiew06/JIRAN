import { useState } from 'react';
import type { Me } from '../api.ts';
import { HouseArt } from '../house.tsx';
import { Icon } from '../icons.tsx';
import { Avatar, Chips, Toggle, toggleIn, useApp } from '../ui.tsx';

export interface Draft {
  firstName: string; avatar: string; houseColor: string; photo: string | null; bio: string;
  interests: string[]; activities: string[]; languages: string[]; availability: string[];
  lang: string; openToMeet: boolean; isBuddy: boolean; privacy: { directory: boolean; showInterests: boolean };
}

export const draftFrom = (me: Me): Draft => ({
  firstName: me.firstName, avatar: me.avatar, houseColor: me.houseColor, photo: me.photo, bio: me.bio,
  interests: me.interests, activities: me.activities, languages: me.languages, availability: me.availability,
  lang: me.lang, openToMeet: me.openToMeet, isBuddy: me.isBuddy, privacy: me.privacy,
});

/** Shrink a chosen photo to a small square JPEG so it fits the profile. */
async function toSmallPhoto(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const side = Math.min(img.width, img.height);
    const c = document.createElement('canvas');
    c.width = c.height = 160;
    c.getContext('2d')!.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, 160, 160);
    return c.toDataURL('image/jpeg', 0.82);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function BasicsFields({ d, set }: { d: Draft; set: (p: Partial<Draft>) => void }) {
  const { options, toast } = useApp();
  return (
    <div className="stack12">
      <div className="row gap12">
        <Avatar name={d.firstName || '?'} color={d.avatar} photo={d.photo} size={64} />
        <div className="stack8 grow">
          <label className="btn small file-btn" htmlFor="photo-input"><Icon name="camera" /> {d.photo ? 'Change photo' : 'Add a photo'}</label>
          <input id="photo-input" className="sr-only" type="file" accept="image/png,image/jpeg,image/webp"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              try { set({ photo: await toSmallPhoto(f) }); } catch { toast('That photo could not be read', 'warn'); }
            }} />
          {d.photo && <button type="button" className="link-btn" onClick={() => set({ photo: null })}>Remove photo</button>}
        </div>
      </div>
      <label className="field-label" htmlFor="p-name">Display name (neighbours see this and your street)</label>
      <input id="p-name" className="input" value={d.firstName} maxLength={24} onChange={(e) => set({ firstName: e.target.value })} />
      <div className="field-label">Avatar colour</div>
      <div className="swatches" role="radiogroup" aria-label="Avatar colour">
        {options.avatarColors.map((c) => <button key={c} type="button" role="radio" aria-checked={d.avatar === c} aria-label={`Avatar colour ${c}`} className={d.avatar === c ? 'swatch on' : 'swatch'} style={{ background: c }} onClick={() => set({ avatar: c })} />)}
      </div>
      <div className="field-label">House colour on the map</div>
      <div className="row gap12">
        <HouseArt wall="#FFF8EE" roof={d.houseColor} w={60} h={56} />
        <div className="swatches" role="radiogroup" aria-label="House colour">
          {options.houseColors.map((c) => <button key={c} type="button" role="radio" aria-checked={d.houseColor === c} aria-label={`House colour ${c}`} className={d.houseColor === c ? 'swatch on' : 'swatch'} style={{ background: c }} onClick={() => set({ houseColor: c })} />)}
        </div>
      </div>
      <label className="field-label" htmlFor="p-bio">A short introduction</label>
      <textarea id="p-bio" className="input" rows={3} maxLength={280} value={d.bio} placeholder="e.g. Mum of two, weekend baker, new to Klang" onChange={(e) => set({ bio: e.target.value })} />
    </div>
  );
}

export function InterestFields({ d, set }: { d: Draft; set: (p: Partial<Draft>) => void }) {
  const { options } = useApp();
  return (
    <div className="stack12">
      <div className="field-label">Hobbies and interests <span className="muted">(up to 8)</span></div>
      <Chips multi wrap label="Interests" value={d.interests} options={options.interests.map((x) => ({ id: x, label: x }))} onChange={(x) => set({ interests: toggleIn(d.interests, x).slice(0, 8) })} />
      <div className="field-label">Activities you would join</div>
      <Chips multi wrap label="Activities" value={d.activities} options={options.activities.map((x) => ({ id: x, label: x }))} onChange={(x) => set({ activities: toggleIn(d.activities, x).slice(0, 6) })} />
      <div className="field-label">Languages you speak</div>
      <Chips multi wrap label="Languages" value={d.languages} options={options.languages.map((x) => ({ id: x, label: x }))} onChange={(x) => set({ languages: toggleIn(d.languages, x) })} />
      <div className="field-label">When you are usually free</div>
      <Chips multi wrap label="Free times" value={d.availability} options={options.timeSlots.map((x) => ({ id: x.id, label: x.label }))} onChange={(x) => set({ availability: toggleIn(d.availability, x) })} />
    </div>
  );
}

export function SettingsFields({ d, set }: { d: Draft; set: (p: Partial<Draft>) => void }) {
  const { options } = useApp();
  return (
    <div className="stack12">
      <div className="field-label">App language</div>
      <Chips wrap label="App language" value={d.lang} options={options.appLangs.map((l) => ({ id: l.id, label: l.label }))} onChange={(x) => set({ lang: x })} />
      <Toggle id="t-open" label="Open to meeting new people" hint="Shows you in “Open to meet” suggestions" checked={d.openToMeet} onChange={(v) => set({ openToMeet: v })} />
      <Toggle id="t-buddy" label="Volunteer as a community buddy" hint="Help newcomers find their way around" checked={d.isBuddy} onChange={(v) => set({ isBuddy: v })} />
      <Toggle id="t-dir" label="Show me in the resident directory" hint="Off: only connected neighbours see your profile" checked={d.privacy.directory} onChange={(v) => set({ privacy: { ...d.privacy, directory: v } })} />
      <Toggle id="t-int" label="Show my interests to neighbours" hint="Off: you won’t appear in interest matches" checked={d.privacy.showInterests} onChange={(v) => set({ privacy: { ...d.privacy, showInterests: v } })} />
    </div>
  );
}

export function useDraft(me: Me) {
  const [d, setD] = useState<Draft>(() => draftFrom(me));
  return { d, set: (p: Partial<Draft>) => setD((x) => ({ ...x, ...p })), reset: () => setD(draftFrom(me)) };
}
