// The canvas needs room: a phone-sized viewport gets a notice instead. A tablet
// is wide enough, so it is let through. The notice sits in the top layer above
// every dialog, and everything else is made inert while it shows.
const gate = document.querySelector('#device-gate');
const small = matchMedia('(max-width: 599px), (pointer: coarse) and (max-height: 499px)');

function apply() {
  const block = small.matches;
  for (const element of document.body.children) if (element !== gate && element.tagName !== 'SCRIPT') element.inert = block;
  document.documentElement.toggleAttribute('data-device-blocked', block);
  if (block && !gate.matches(':popover-open')) gate.showPopover();
  if (!block && gate.matches(':popover-open')) gate.hidePopover();
}
small.addEventListener('change', apply);
apply();
