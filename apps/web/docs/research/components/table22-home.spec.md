# Table22Home Specification

## Overview
- Target files: `src/app/page.tsx`, `src/app/globals.css`, `src/app/layout.tsx`
- Screenshots: `table22-desktop-top.png`, `table22-mobile-top.png`
- Interaction model: sticky nav, hover-driven cards/buttons; Webflow tab states represented statically.

## DOM Structure
- Sticky nav: logo, desktop nav links, CTA.
- Hero: kicker, large heading, storefront preview card, CTA, operator collage.
- Revenue: dark green split section, value props, three image cards.
- Industries: cream section, tab pills, image/product cards.
- Process: white section, four step cards.
- Platform: cream section, feature grid and product cards.
- Comparison: matrix table.
- Mission: dark green section with quote and press logos.
- CTA/Footer: dark green CTA, cream footer columns.

## Computed Styles
- Body font: Arial, sans-serif.
- Deep green: rgb(0, 55, 46).
- Mid green: rgb(5, 87, 72).
- Cream: rgb(250, 250, 240).
- Warm grey: rgb(238, 238, 228).
- Mobile hero h1: 30.5221px / 30.5221px, 500, green.
- Mobile green-section h2: 24.9726px / 27.4699px, cream.
- Mobile step h3: 19.4232px / 19.4232px, green.

## Assets
Use original CDN image URLs via regular `img` tags to preserve real content and avoid blocking clone on local downloads. Key assets include hero operator images and section editorial/product images from Webflow CDN.

## Text Content
Use verbatim extracted text for all headings and cards from Table22 homepage.

## Responsive Behavior
- Desktop: max-width content ~1180px, large two-column grids, hero collage.
- Tablet: grids collapse to two columns where possible.
- Mobile: single-column stacks, compact nav, smaller headings, horizontally scrollable pills.
