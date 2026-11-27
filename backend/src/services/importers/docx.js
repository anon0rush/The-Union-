import mammoth from 'mammoth';

const STYLE_MAP = ["p[style-name='Title'] => h1:fresh", "p[style-name='Subtitle'] => h2:fresh"];

export async function convertDocx(buffer) {
  const { value } = await mammoth.convertToHtml(
    { buffer },
    {
      styleMap: STYLE_MAP,
      convertImage: mammoth.images.imgElement(() => ({ src: '' })),
    },
  );
  return value
    .replace(/<img[^>]*>/g, '')
    .replace(/<h([4-6])>/g, '<h3>')
    .replace(/<\/h[4-6]>/g, '</h3>')
    .replace(/<p>\s*<\/p>/g, '');
}
