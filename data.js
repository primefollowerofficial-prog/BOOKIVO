'use strict';
/* ============================================
   BOOKIVO.IN — Catalogue snapshot (frontend fallback data)
   This is NOT fake product filler: slot #1 is the real, existing
   Bachelor 99 Survival Cookbook with its exact current content.
   All other slots stay empty until published through the admin panel
   (backend phase). The storefront renders skeletons only while a live
   catalogue request is in flight and hides unfilled slots otherwise.

   Once Supabase is wired, BookivoSite.getCatalogue() prefers
   GET /api/products and uses this file only as an offline fallback.
   ============================================ */

const BOOKIVO_CATALOGUE = [
  {
    id: 'b99-cookbook',
    slug: 'bachelor-99-survival-cookbook',
    title: 'Bachelor 99 Survival Cookbook',
    subtitle: "99 easy Indian meals for when you don't know what to cook.",
    author: 'Bachelor 99',
    category: 'Cooking & Food',
    keywords: ['cookbook', 'recipes', 'indian meals', 'budget', 'bachelor', 'easy cooking', '99 recipe bachler\'s cook book'],
    shortDescription: '99 simple, budget-friendly Indian recipes for bachelors, students and total beginners.',
    description: "99 no-nonsense recipes built for bachelor budgets — cheap ingredients, minimal equipment, and meals that actually taste like food, not compromise.",
    coverImage: 'images/Ebook1.png',
    gallery: ['images/Ebook1.png', 'images/book1.png', 'images/book2.png', 'images/book3.png', 'images/book4.png', 'images/book5.png', 'images/book6.png', 'images/book7.png'],
    sellingPrice: 99,
    originalPrice: 199,
    rating: 4.8,
    reviewCount: 113,
    featured: true,
    published: true,
    url: 'index.html#product', // legacy page preserved exactly (Section 2 of migration plan)
    benefits: [
      'Most Meals Under ₹99',
      'Instant PDF Download',
      'Ready in 30 Minutes',
      'Perfect for Beginners'
    ]
  }
];

window.BOOKIVO_CATALOGUE = BOOKIVO_CATALOGUE;
