import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAccess } from '../access/context.js';
import { roleLabel } from '../access/level.js';
import { AVATARS, AVATAR_GROUPS, FEATURED_AVATAR_IDS, NICKNAME_MAX, avatarById, displayNameFor, savedAvatarId } from '../access/avatars.js';
import { Avatar } from './Avatar.jsx';
import { Icon } from './icons.jsx';

function AvatarOption({ avatar, name, selected, onSelect, radioName }) {
  return (
    <label className="v3-avatar-choice" data-selected={selected}>
      <input type="radio" name={radioName} value={avatar.id} aria-label={avatar.label} checked={selected} onChange={() => onSelect(avatar.id)} />
      <Avatar avatar={avatar.id} name={name} size={42} />
      <span className="v3-avatar-choice-name">{avatar.label}</span>
    </label>
  );
}

/**
 * The profile bubble in the top-right corner, and its menu: who you are, a nickname and a Solar Crew portrait,
 * Settings, and sign in / sign out. Signed-in profiles are saved to the account; visitors' to this browser.
 */
export function AccountMenu() {
  const { level, email, firstName, profile, saveProfile, signOut, clerk } = useAccess();
  const [open, setOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [nick, setNick] = useState(profile.nickname);
  const [status, setStatus] = useState('');
  const ref = useRef(null);
  const menuId = useId();
  const role = roleLabel(level === 'loading' ? 'none' : level);
  const name = displayNameFor({ nickname: profile.nickname, firstName, email, fallback: role.label });
  const signedIn = level === 'viewer' || level === 'admin';
  const currentAvatar = savedAvatarId(profile.avatar);
  const featuredIds = currentAvatar && !FEATURED_AVATAR_IDS.includes(currentAvatar)
    ? [currentAvatar, ...FEATURED_AVATAR_IDS.slice(0, 7)] : FEATURED_AVATAR_IDS;

  useEffect(() => { setNick(profile.nickname); }, [profile.nickname]);
  useEffect(() => {
    if (!open) return undefined;
    const away = (e) => { if (ref.current && !ref.current.contains(e.target)) { setOpen(false); setShowAll(false); } };
    const esc = (e) => { if (e.key === 'Escape') { setOpen(false); setShowAll(false); } };
    document.addEventListener('pointerdown', away);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', away); document.removeEventListener('keydown', esc); };
  }, [open]);

  const save = async (next) => {
    setStatus('Saving…');
    try {
      await saveProfile({ ...profile, ...next });
      setStatus('Saved');
    } catch {
      setStatus('Could not save');
    }
  };

  return (
    <div className="v3-account" ref={ref}>
      <button type="button" className="v3-account-btn" aria-haspopup="true" aria-expanded={open} aria-controls={menuId} aria-label={`Account: ${name}, ${role.label}`} onClick={() => { setOpen((v) => !v); setShowAll(false); }}>
        <Avatar avatar={profile.avatar} name={name} size={34} />
      </button>
      {open && (
        <div id={menuId} className="v3-glass v3-menu" role="dialog" aria-label="Account">
          <div className="v3-menu-head">
            <Avatar avatar={profile.avatar} name={name} size={44} />
            <div style={{ minWidth: 0 }}>
              <b className="v3-menu-name">{name}</b>
              <div className="v3-sub" style={{ margin: 0 }}>{role.label} · {role.sub}</div>
              {email && <div className="v3-sub v3-ellipsis" style={{ margin: 0 }}>{email}</div>}
            </div>
          </div>

          <form className="v3-menu-section" onSubmit={(e) => { e.preventDefault(); save({ nickname: nick }); }}>
            <label className="v3-plantfield" style={{ gap: 6 }}>
              <span>Nickname</span>
              <span style={{ display: 'flex', gap: 8 }}>
                <input className="v3-field" style={{ flex: '1 1 auto', minWidth: 0 }} maxLength={NICKNAME_MAX} value={nick} placeholder={firstName || 'What should we call you?'} onChange={(e) => { setNick(e.target.value); setStatus(''); }} />
                <button type="submit" className="v3-btn" disabled={nick.trim() === profile.nickname}>Save</button>
              </span>
            </label>
          </form>

          <div className="v3-menu-section">
            <span className="v3-menu-label">Choose your avatar</span>
            <div className="v3-avatar-choices" role="radiogroup" aria-label="Profile picture">
              {showAll ? AVATAR_GROUPS.map((group) => (
                <div className="v3-avatar-group" key={group.id}>
                  <span className="v3-avatar-group-name">{group.label}</span>
                  <div className="v3-avatar-grid">
                    {group.avatars.map(([id]) => <AvatarOption key={id} avatar={avatarById(id)} name={name} selected={currentAvatar === id} onSelect={(avatar) => save({ avatar })} radioName={menuId} />)}
                  </div>
                </div>
              )) : (
                <div className="v3-avatar-grid">
                  {featuredIds.map((id) => <AvatarOption key={id} avatar={avatarById(id)} name={name} selected={currentAvatar === id} onSelect={(avatar) => save({ avatar })} radioName={menuId} />)}
                </div>
              )}
            </div>
            <button type="button" className="v3-avatar-more" aria-expanded={showAll} onClick={() => setShowAll((v) => !v)}>{showAll ? 'Show featured' : `View all ${AVATARS.length} avatars`}</button>
            <div className="v3-sub" style={{ margin: 0, minHeight: 16 }} role="status">{status || (signedIn ? 'Saved to your account.' : 'Saved in this browser.')}</div>
          </div>

          <div className="v3-menu-actions">
            <Link to="/settings" className="v3-menu-item" onClick={() => { setOpen(false); setShowAll(false); }}><Icon id="settings" size={17} />Settings</Link>
            {signedIn && signOut && (
              <button type="button" className="v3-menu-item" onClick={() => { setOpen(false); setShowAll(false); signOut(); }}><Icon id="signout" size={17} />Sign out</button>
            )}
            {!signedIn && clerk && (
              <Link to="/signin" className="v3-menu-item" onClick={() => { setOpen(false); setShowAll(false); }}><Icon id="signin" size={17} />Sign in</Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
