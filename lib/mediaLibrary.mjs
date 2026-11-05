// The brand assets shown in Admin → Media, in display order. Paths are relative to branding/
// and exclude the extension. scripts/prepare-media.mjs publishes them at build time.
export const mediaBase = '/media-library';
const logoVariants = [
  ['color', 'Full color', 'Transparent background', false],
  ['navy', 'Navy', 'One color, transparent background', false],
  ['white', 'White', 'For dark backgrounds and photos', true],
  ['color-white-background', 'Full color on white', 'For documents and vendors that need a solid background', false],
  ['navy-white-background', 'Navy on white', 'One color on a solid background', false],
];
const logos = (layout, label) => logoVariants.map(([variant, name, use, dark]) => ({ path: `logos/dwights-gutters-${layout}-${variant}`, name: `${label} · ${name}`, use, formats: ['png', 'svg'], dark }));
const png = (path, name, use) => ({ path, name, use, formats: ['png'] });
const both = (path, name, use, dark = false) => ({ path, name, use, formats: ['png', 'svg'], dark });
export const mediaGroups = [
  { id: 'logos-primary', title: 'Primary logo', intro: 'The main logo. Use it wherever there’s room.', items: logos('primary', 'Primary') },
  { id: 'logos-compact', title: 'Compact logo', intro: 'For tighter spaces like headers, invoices, and truck door magnets.', items: logos('compact', 'Compact') },
  { id: 'logos-stacked', title: 'Stacked logo', intro: 'For square spaces like yard signs, shirts, and stickers.', items: logos('stacked', 'Stacked') },
  { id: 'marks', title: 'Logo mark', intro: 'The symbol on its own, for very small spaces.', items: [
    both('marks/dwights-gutters-mark-color', 'Mark · Full color', 'Transparent background'),
    both('marks/dwights-gutters-mark-navy', 'Mark · Navy', 'One color, transparent background'),
    both('marks/dwights-gutters-mark-white', 'Mark · White', 'For dark backgrounds and photos', true),
  ] },
  { id: 'social', title: 'Social and web', intro: 'Profile images and site graphics.', items: [
    both('web/social-avatar-light', 'Social avatar · Light', 'Facebook, Google, and Yelp profile photos'),
    both('web/social-avatar-navy', 'Social avatar · Navy', 'Profile photos on a navy background'),
    both('web/website-header', 'Website header', 'Wide banner for profile covers and email headers'),
    both('web/favicon', 'Favicon', 'The browser tab icon'),
    png('web/icon-512', 'App icon · 512 px', 'Largest icon size'),
    png('web/icon-192', 'App icon · 192 px', 'Phone home screens'),
    png('web/icon-180', 'App icon · 180 px', 'iPhone home screens'),
    png('web/icon-48', 'Icon · 48 px', 'Small icon'),
    png('web/icon-32', 'Icon · 32 px', 'Small icon'),
    png('web/icon-16', 'Icon · 16 px', 'Smallest icon'),
  ] },
  { id: 'print', title: 'Print', intro: 'Business cards. Send the print-ready PDF to a print shop.', items: [
    { path: 'print/business-cards', preview: 'print/business-card-front', name: 'Business cards · Print-ready', use: 'Front and back, ready for a print shop', formats: ['pdf'] },
    both('print/business-card-front', 'Card front', 'Trimmed size, for viewing'),
    both('print/business-card-back', 'Card back', 'Trimmed size, for viewing'),
    both('print/business-card-front-bleed', 'Card front with bleed', 'For printers that ask for bleed'),
    both('print/business-card-back-bleed', 'Card back with bleed', 'For printers that ask for bleed'),
  ] },
  { id: 'photography', title: 'Photography', intro: 'Illustrative images, not photos of completed jobs. Don’t present them as Dwight’s work.', items: [
    png('photography/austin-home', 'Austin home', 'Limestone home with white gutters'),
    png('photography/austin-neighborhood', 'Austin neighborhood', 'Tree-lined residential street'),
    png('photography/gutter-cleaning', 'Gutter cleaning', 'Close-up of leaves being cleared from a gutter'),
  ] },
  { id: 'brand-sheet', title: 'Brand sheet', intro: 'One page showing the logos and colors together. Handy for sign shops and designers.', items: [
    { path: 'brand-sheet', name: 'Brand sheet', use: 'Logos and colors at a glance', formats: ['pdf', 'png', 'svg'] },
  ] },
];
export const brandColors = [
  { name: 'Navy', hex: '#142D4E', use: 'Main text and logo' },
  { name: 'Safety orange', hex: '#F47721', use: 'Accents and buttons' },
  { name: 'Cream', hex: '#FFF2E8', use: 'Soft backgrounds' },
  { name: 'White', hex: '#FFFFFF', use: 'Backgrounds' },
];
export const mediaItems = () => mediaGroups.flatMap(group => group.items);
export const assetFiles = item => item.formats.map(format => `${item.path}.${format}`);
export const previewPath = item => item.preview || item.path;
export const previewUrl = item => `${mediaBase}/previews/${previewPath(item)}.webp`;
export const assetUrl = (item, format) => `${mediaBase}/${item.path}.${format}`;
