import msSystems from '../assets/logos/ms-systems.svg';
import mephub from '../assets/logos/mephub.svg';
import vdclab from '../assets/logos/vdclab.svg';
import permit from '../assets/logos/permit-my-house.svg';

// Each logo is an SVG used as a CSS mask, so its colour comes from
// `color` (currentColor) and can change per context (white on the black panel,
// grey for the secondary brands) without touching the file.
const LOGOS = {
  'ms-systems': { src: msSystems, ratio: 486 / 90, label: 'M&S Systems' },
  mephub: { src: mephub, ratio: 499 / 92, label: 'MEPhub' },
  vdclab: { src: vdclab, ratio: 475 / 92, label: 'VDClab' },
  'permit-my-house': { src: permit, ratio: 514 / 110, label: 'Permit my house' },
};

export default function Logo({ name, height = 24, className = '' }) {
  const logo = LOGOS[name];
  return (
    <span
      role="img"
      aria-label={logo.label}
      className={`logo ${className}`}
      style={{
        height,
        aspectRatio: logo.ratio,
        WebkitMaskImage: `url(${logo.src})`,
        maskImage: `url(${logo.src})`,
      }}
    />
  );
}
