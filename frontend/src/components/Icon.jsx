const PATHS = {
  search: 'M7 12.5a5.5 5.5 0 1 0 0-11 5.5 5.5 0 0 0 0 11ZM11 11l3.5 3.5',
  plus: 'M8 3v10M3 8h10',
  close: 'M4 4l8 8M12 4l-8 8',
  back: 'M10 3.5 5.5 8l4.5 4.5',
  star: 'M8 1.8l1.9 3.9 4.3.6-3.1 3 .7 4.3L8 11.6l-3.8 2 .7-4.3-3.1-3 4.3-.6L8 1.8Z',
  more: 'M3.5 8h.01M8 8h.01M12.5 8h.01',
  doc: 'M4 1.5h5L12.5 5v9.5h-8.5zM9 1.5V5h3.5M6 8.5h4.5M6 11h4.5',
  outline: 'M2.5 3.5h11M5 8h8.5M7.5 12.5h6',
  history: 'M2.5 8a5.5 5.5 0 1 0 1.6-3.9M2.5 2.5v2.5H5M8 5v3l2 1.5',
  activity: 'M1.5 8h3l1.5-4 3 8 1.5-4h4',
  download: 'M8 2v8M4.5 6.5 8 10l3.5-3.5M2.5 13.5h11',
  share: 'M10.5 5.5 8 3 5.5 5.5M8 3v7.5M3.5 8.5v5h9v-5',
  sun: 'M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM8 1v1.5M8 13.5V15M1 8h1.5M13.5 8H15M3 3l1 1M12 12l1 1M3 13l1-1M12 4l1-1',
  moon: 'M13.5 9.5A5.5 5.5 0 0 1 6.5 2.5a5.5 5.5 0 1 0 7 7Z',
  monitor: 'M1.5 2.5h13v8.5h-13zM5.5 14h5M8 11v3',
  keyboard: 'M1.5 4h13v8h-13zM4 6.5h.01M6.5 6.5h.01M9 6.5h.01M11.5 6.5h.01M5 9.5h6',
  signout: 'M6 2.5H2.5v11H6M10.5 5 13.5 8l-3 3M13.5 8H6',
  undo: 'M5 3.5 2 6.5l3 3M2 6.5h7.5a3.5 3.5 0 0 1 0 7H7',
  redo: 'M11 3.5l3 3-3 3M14 6.5H6.5a3.5 3.5 0 0 0 0 7H9',
  link: 'M6.5 9.5a2.8 2.8 0 0 0 4 0l2.3-2.3a2.8 2.8 0 0 0-4-4L8 4M9.5 6.5a2.8 2.8 0 0 0-4 0L3.2 8.8a2.8 2.8 0 0 0 4 4L8 12',
  listBullet: 'M6 4h8M6 8h8M6 12h8M2.5 4h.01M2.5 8h.01M2.5 12h.01',
  listOrdered: 'M6.5 4h7.5M6.5 8h7.5M6.5 12h7.5M2 3l1-.5V6M2 9.5h1.8L2 12h2',
  checklist: 'M2 4l1 1 2-2M2 10l1 1 2-2M7 4.5h7M7 10.5h7',
  quote: 'M3 4.5v7M6.5 5.5h7M6.5 8h7M6.5 10.5h5',
  codeBlock: 'M5.5 4.5 2 8l3.5 3.5M10.5 4.5 14 8l-3.5 3.5',
  divider: 'M1.5 8h13',
  alignLeft: 'M2 3.5h12M2 6.5h8M2 9.5h12M2 12.5h8',
  alignCenter: 'M2 3.5h12M4 6.5h8M2 9.5h12M4 12.5h8',
  alignRight: 'M2 3.5h12M6 6.5h8M2 9.5h12M6 12.5h8',
  highlight: 'M9.5 2.5l4 4-6 6H3.5v-4zM2 14.5h12',
  inlineCode: 'M6 4.5 2.5 8 6 11.5M10 4.5l3.5 3.5-3.5 3.5',
  eye: 'M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5ZM8 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z',
  enter: 'M13 3v5.5H3M6 5.5 3 8.5l3 3',
  upload: 'M8 10.5V2.5M4.5 6 8 2.5 11.5 6M2.5 10.5v3h11v-3',
  grid: 'M2.5 2.5h4.5V7H2.5zM9 2.5h4.5V7H9zM2.5 9h4.5v4.5H2.5zM9 9h4.5v4.5H9z',
  list: 'M2.5 4h11M2.5 8h11M2.5 12h11',
  printer: 'M4.5 6V2.5h7V6M4.5 11.5h-2v-5.5h11v5.5h-2M4.5 9.5h7v4h-7z',
};

export default function Icon({ name, size = 16, filled = false, className }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
