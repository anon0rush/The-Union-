import { initials } from '../lib/format.js';

export default function Avatar({ user, size = 28, ring = false, title }) {
  return (
    <span
      className={`avatar${ring ? ' ring' : ''}`}
      style={{ background: user.color, width: size, height: size, fontSize: size * 0.4 }}
      title={title ?? user.name}
    >
      {initials(user.name)}
    </span>
  );
}
