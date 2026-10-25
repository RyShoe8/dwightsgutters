# Approved Dwight's Gutters branding

The approved layout source is source/approved-logo.png, copied unchanged from the user-supplied image on October 21, 2026. Current color exports use source/approved-logo-orange.png: only the blue accent pixels were recolored to safety orange #F47721 from the Bold & Visible concept. All alpha pixels and artwork geometry are unchanged. The original blue file is retained as source history, not a current delivery logo.

Source resolution: 2043 x 770 with transparency. Native crops are in source/derived. Color versions preserve the geometry and alpha; navy/white versions preserve alpha and change only RGB. Compact/stacked layouts reposition original cropped artwork.

SVG files embed raster artwork: they are NOT vector-traced logos. Large PNG exports are resampled delivery sizes, not additional source detail. PDF files use the same artwork. For large signage a higher-resolution or faithfully matched vector master would be needed.

logos/: primary, compact, stacked in color/navy/white. marks/: cropped D symbol. web/: avatars, header and icons. print/: actual flat business card images and bleed variants. Business card PDF: two pages, 3.75 x 2.25 inches with 0.125 inch bleed and 3.5 x 2 inch trim. PNG cards: 2100 x 1200 at 600 ppi; intrinsic logo resolution still applies. Color proof with your printer.

brand-sheet.png/.svg/.pdf: current overview. palette.css/.json: navy #142D4E, safety orange #F47721, cream #FFF2E8, white #FFFFFF. Original artwork shading is preserved.

Do not regenerate or redraw this logo. White versions are for dark backgrounds. Historical concepts in historical-not-for-use are excluded from the delivery ZIP. Current Next.js repo: D:/dwightsgutters/site.

Rebuild: node source/recolor-orange.cjs; node source/derive-approved.cjs; python source/build_brand.py; node source/export_png.cjs; python source/export_pdf.py. Run from the repository using branding/source paths. Website export: node branding/source/export-site.cjs.
