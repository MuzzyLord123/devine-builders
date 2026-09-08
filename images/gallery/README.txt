EASIEST WAY TO CHANGE THESE PHOTOS
----------------------------------
Open the website's /admin/ page, scroll to "Gallery images", and add,
replace, reorder or re-caption photos there. Press Publish and it hands
you the exact files to upload back into this folder. No code, and it
shrinks big phone photos for you so the site stays fast.

The notes below are for doing it by hand instead.

Devine Builders — Gallery images
=================================

This folder holds the photos shown on gallery.html.

ADDING YOUR OWN PHOTOS
----------------------
1. Drop your image files into THIS folder
   (the images/gallery/ folder inside the site folder).
   Supported formats: JPG / JPEG, PNG, or WebP.

2. gallery.html loads these exact filenames from this folder:
       photo-kitchen.jpg
       photo-bathroom.jpg
       photo-extension.jpg
       photo-driveway.jpg
       photo-brickwork.jpg
       photo-roofing.jpg
       photo-landscaping.jpg
   plus the Before & After pairs:
       ba-kitchen-before.jpg / ba-kitchen-after.jpg
       ba-bathroom-before.jpg / ba-bathroom-after.jpg

3. To replace a stock photo with your own, save your photo over the
   matching filename above (same name, same folder) and it appears
   automatically. To use a different filename, also update the src
   (and data-full) in gallery.html — and update the alt text and
   remove the "Illustrative" label for that slot, since it will then
   be a real job photo.

HOMEPAGE HERO IMAGE
-------------------
The photo backdrop at the top of the home page is images/hero-kitchen.jpg,
referenced directly in index.html. To change it, replace that file
(roughly 1920px wide) and regenerate its companion files noted in
index.html's comments (the 960w downscale and the edge-trace overlay).

IF A PHOTO IS MISSING
---------------------
The page is resilient. gallery.js detects a missing/broken image and
swaps in a tidy "Devine Builders — Photo coming soon" placeholder so the
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
