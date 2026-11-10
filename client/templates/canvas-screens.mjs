// The list of pages the canvas shows. One block between { and } is one page.
// Copy a block to add a page. Keep the commas, the quotes and the brackets.
//
//   id           a short unique name, letters and dashes only (home, about-us)
//   kind         'production' for a finished page, 'prototype' for an idea
//   title        the name shown above the page on the canvas
//   src          the address of the page, starting with / (for example /index.html)
//   x, y         where the page sits on the canvas
//   width,height the size of the page in pixels
//   preset       'laptop', 'iphone-16' or 'ipad-air'
//
// Do not add any "import" line to this file.
export const storageKey = 'my-project:canvas:v1'; // change my-project to your project name

export const screens = [
  {
    id: 'home', kind: 'production', title: 'Home',
    src: '/index.html', x: 160, y: 160, width: 1440, height: 900, preset: 'laptop',
  },
  {
    id: 'home-phone', kind: 'production', title: 'Home on a phone',
    src: '/index.html', x: 1700, y: 160, width: 390, height: 844, preset: 'iphone-16',
  },
];
