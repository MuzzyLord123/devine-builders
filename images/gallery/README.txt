Devine Builders — Gallery images
=================================

This folder holds the photos shown on gallery.html.

ADDING YOUR OWN PHOTOS
----------------------
1. Drop your image files into THIS folder
   (C:\Users\Fortn\Downloads\devinebuilders\images\gallery\).
   Supported formats: JPG / JPEG, PNG, or WebP.

2. Recommended naming so they map cleanly to the page:
       project-1.jpg
       project-2.jpg
       project-3.jpg
       project-4.jpg
       project-5.jpg
       project-6.jpg
   (Any name works — just match the src in gallery.html.)

3. Each example slot in gallery.html already points at one of these
   filenames, e.g.:

       <img class="gallery__img"
            src="images/gallery/project-1.jpg"
            alt="Describe the photo here" ...>

   So if you save a photo as "project-1.jpg" it appears automatically —
   no code changes needed.

HOMEPAGE HERO IMAGE
-------------------
The large photo at the top of the home page (index.html) currently shows
a bundled placeholder (placeholder-1.svg) so the page never looks broken.
To use a real photo, drop a landscape image into THIS folder named:

       hero.jpg

then open index.html and change the hero <img> src from
"images/gallery/placeholder-1.svg" to "images/gallery/hero.jpg".
(Aim for roughly 1600px on the long edge — it's shown large.)

IF A PHOTO IS MISSING
---------------------
The page is resilient. gallery.js detects a missing/broken image and
swaps in a tidy "Devine Builders — Project Photo" placeholder so the
gallery never looks broken. The bundled placeholder-1.svg ... -6.svg
files are also available if you'd rather point a figure at one of them
directly (e.g. src="images/gallery/placeholder-1.svg").

ADDING MORE THAN SIX PHOTOS
---------------------------
Open gallery.html, copy one whole <figure>/<li class="gallery__item">
block, paste it, then update three things:
   - src  → the new image filename
   - alt  → a short, accurate description of the photo (for screen readers)
   - <figcaption> text → the short caption shown under the thumbnail
Optionally set data-caption on the button for a longer lightbox caption,
and data-full for a larger version of the image.

GOOD PHOTO TIPS
---------------
- Landscape orientation works best (the grid uses a 4:3 crop).
- Aim for roughly 1200px on the long edge — sharp but not huge.
- Compress JPGs to keep the page fast (WebP is smaller still).
- Always write meaningful alt text describing what's in the photo.
