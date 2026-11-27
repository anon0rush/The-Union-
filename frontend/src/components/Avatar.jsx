import { initials } from '../utils/format.js';

export default function Avatar({ user, size = 28, ring = false, title }) {
  return (
    <span
      className={`avatar${ring ? ' ring' : ''}`}
      style={{ background: user.color, width: size, height: size, fontSize: Math.round(size * 0.4) }}
      title={title === undefined ? user.name : title ?? undefined}
    >
      {initials(user.name)}
    </span>
  );
}
