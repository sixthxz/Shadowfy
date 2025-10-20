@import "tailwindcss";

module.exports = {
  content: [
    './public/**/*.html',
    './public/js/**/*.js',
  ],
  safelist: ['bg-[#1db954]', 'text-white', 'hover:bg-[#1ed760]'],
  theme: {
    extend: {},
  },
  plugins: [],
}
