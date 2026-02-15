// backend/templates.js
// HTML Skeleton Templates — pre-built structure with {{PLACEHOLDER}} markers
// AI generates ONLY text content + CSS + JS; structure is guaranteed.

// ============================================
// SECTION METADATA — image counts, IDs, nav labels
// ============================================
const SECTION_META = {
    1: { id: 'services',     nav: 'Services',  imageCount: 3, name: 'Card Grid' },
    2: { id: 'about',        nav: 'About',     imageCount: 2, name: 'Split Image+Text' },
    3: { id: 'showcase',     nav: 'Showcase',   imageCount: 1, name: 'Full-Width Image Break' },
    4: { id: 'stats',        nav: 'Results',    imageCount: 0, name: 'Dark Stats Banner' },
    5: { id: 'testimonials', nav: 'Reviews',    imageCount: 0, name: 'Testimonials' },
    6: { id: 'gallery',      nav: 'Gallery',    imageCount: 3, name: 'Bento Grid' },
    7: { id: 'process',      nav: 'Process',    imageCount: 3, name: 'Zigzag' },
    8: { id: 'featured',     nav: 'Featured',   imageCount: 1, name: 'Feature Spotlight' },
};

// Placeholder keys per section (used for prompt + validation)
const SECTION_PLACEHOLDERS = {
    1: ['SERVICES_TITLE', 'SERVICES_SUBTITLE', 'SERVICES_CARD1_TITLE', 'SERVICES_CARD1_TEXT', 'SERVICES_CARD2_TITLE', 'SERVICES_CARD2_TEXT', 'SERVICES_CARD3_TITLE', 'SERVICES_CARD3_TEXT'],
    2: ['ABOUT_TITLE', 'ABOUT_HEADING1', 'ABOUT_TEXT1', 'ABOUT_HEADING2', 'ABOUT_TEXT2'],
    3: ['SHOWCASE_HEADLINE', 'SHOWCASE_SUBTITLE'],
    4: ['STATS_TITLE', 'STATS_1_NUMBER', 'STATS_1_LABEL', 'STATS_2_NUMBER', 'STATS_2_LABEL', 'STATS_3_NUMBER', 'STATS_3_LABEL', 'STATS_4_NUMBER', 'STATS_4_LABEL'],
    5: ['TESTIMONIALS_TITLE', 'TESTIMONIAL_1_QUOTE', 'TESTIMONIAL_1_NAME', 'TESTIMONIAL_1_ROLE', 'TESTIMONIAL_2_QUOTE', 'TESTIMONIAL_2_NAME', 'TESTIMONIAL_2_ROLE', 'TESTIMONIAL_3_QUOTE', 'TESTIMONIAL_3_NAME', 'TESTIMONIAL_3_ROLE'],
    6: ['GALLERY_TITLE', 'GALLERY_SUBTITLE', 'GALLERY_ITEM1_TITLE', 'GALLERY_ITEM1_TEXT', 'GALLERY_ITEM2_TITLE', 'GALLERY_ITEM2_TEXT', 'GALLERY_ITEM3_TITLE', 'GALLERY_ITEM3_TEXT'],
    7: ['PROCESS_TITLE', 'PROCESS_SUBTITLE', 'PROCESS_STEP1_TITLE', 'PROCESS_STEP1_TEXT', 'PROCESS_STEP2_TITLE', 'PROCESS_STEP2_TEXT', 'PROCESS_STEP3_TITLE', 'PROCESS_STEP3_TEXT'],
    8: ['FEATURED_TITLE', 'FEATURED_SUBTITLE', 'FEATURED_TEXT', 'FEATURED_CTA'],
};

const HERO_PLACEHOLDERS = ['NAV_BRAND', 'HERO_HEADLINE', 'HERO_SUBTITLE', 'HERO_CTA'];
const CONTACT_PLACEHOLDERS = ['CONTACT_TITLE', 'CONTACT_SUBTITLE', 'CONTACT_CTA', 'CONTACT_ADDRESS', 'CONTACT_PHONE', 'CONTACT_EMAIL'];
const FOOTER_PLACEHOLDERS = ['FOOTER_BRAND', 'FOOTER_TAGLINE'];

// ============================================
// HELPER — safe image access with fallback
// ============================================
function safeImage(images, index) {
    if (images && images[index]) {
        return { url: images[index].url, alt: images[index].alt || 'Image' };
    }
    return { url: `https://picsum.photos/seed/placeholder-${index}/800/600`, alt: 'Image' };
}

// ============================================
// SVG SOCIAL ICONS
// ============================================
const SOCIAL_SVGS = {
    facebook: '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>',
    twitter: '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>',
    instagram: '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>',
    linkedin: '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>',
};

// ============================================
// FIXED SECTIONS
// ============================================
function buildNavbar(navItems) {
    const navLinks = navItems.map(item =>
        `      <li class="navbar__item"><a href="#${item.id}" class="navbar__link">${item.label}</a></li>`
    ).join('\n');

    return `<nav class="navbar" id="navbar">
  <div class="navbar__container">
    <a href="#home" class="navbar__brand">{{NAV_BRAND}}</a>
    <button class="navbar__toggle" aria-label="Toggle menu">
      <span class="navbar__toggle-line"></span>
      <span class="navbar__toggle-line"></span>
      <span class="navbar__toggle-line"></span>
    </button>
    <ul class="navbar__menu">
      <li class="navbar__item"><a href="#home" class="navbar__link">Home</a></li>
${navLinks}
      <li class="navbar__item"><a href="#contact" class="navbar__link">Contact</a></li>
    </ul>
  </div>
</nav>`;
}

function buildContact() {
    return `<section class="contact" id="contact">
  <div class="contact__container">
    <h2 class="contact__title">{{CONTACT_TITLE}}</h2>
    <p class="contact__subtitle">{{CONTACT_SUBTITLE}}</p>
    <div class="contact__grid">
      <form class="contact__form" id="contact-form">
        <div class="contact__form-group">
          <label for="name" class="contact__label">Name</label>
          <input type="text" id="name" name="name" class="contact__input" placeholder="Your Name" required>
        </div>
        <div class="contact__form-group">
          <label for="email" class="contact__label">Email</label>
          <input type="email" id="email" name="email" class="contact__input" placeholder="your@email.com" required>
        </div>
        <div class="contact__form-group">
          <label for="message" class="contact__label">Message</label>
          <textarea id="message" name="message" class="contact__textarea" placeholder="How can we help?" rows="5" required></textarea>
        </div>
        <button type="submit" class="contact__submit">{{CONTACT_CTA}}</button>
      </form>
      <div class="contact__info">
        <div class="contact__info-item">
          <h3 class="contact__info-title">Address</h3>
          <p class="contact__info-text">{{CONTACT_ADDRESS}}</p>
        </div>
        <div class="contact__info-item">
          <h3 class="contact__info-title">Phone</h3>
          <p class="contact__info-text">{{CONTACT_PHONE}}</p>
        </div>
        <div class="contact__info-item">
          <h3 class="contact__info-title">Email</h3>
          <p class="contact__info-text">{{CONTACT_EMAIL}}</p>
        </div>
      </div>
    </div>
  </div>
</section>`;
}

function buildFooter(navItems) {
    const footerLinks = [
        '      <a href="#home" class="footer__link">Home</a>',
        ...navItems.map(item =>
            `      <a href="#${item.id}" class="footer__link">${item.label}</a>`
        ),
        '      <a href="#contact" class="footer__link">Contact</a>'
    ].join('\n');

    return `<footer class="footer">
  <div class="footer__container">
    <div class="footer__brand">
      <span class="footer__logo">{{FOOTER_BRAND}}</span>
      <p class="footer__tagline">{{FOOTER_TAGLINE}}</p>
    </div>
    <nav class="footer__nav">
${footerLinks}
    </nav>
    <div class="footer__social">
      <a href="#" class="footer__social-link" aria-label="Facebook">${SOCIAL_SVGS.facebook}</a>
      <a href="#" class="footer__social-link" aria-label="Twitter">${SOCIAL_SVGS.twitter}</a>
      <a href="#" class="footer__social-link" aria-label="Instagram">${SOCIAL_SVGS.instagram}</a>
      <a href="#" class="footer__social-link" aria-label="LinkedIn">${SOCIAL_SVGS.linkedin}</a>
    </div>
    <p class="footer__copyright">&copy; 2026 {{FOOTER_BRAND}}. All rights reserved.</p>
  </div>
</footer>`;
}

// ============================================
// HERO VARIANTS (A–F)
// ============================================
function buildHeroA(imgUrl, imgAlt) {
    return `<section class="hero hero--split" id="home">
  <div class="hero__container">
    <div class="hero__content">
      <h1 class="hero__title">{{HERO_HEADLINE}}</h1>
      <p class="hero__subtitle">{{HERO_SUBTITLE}}</p>
      <a href="#contact" class="hero__cta">{{HERO_CTA}}</a>
    </div>
    <div class="hero__media">
      <img src="${imgUrl}" alt="${imgAlt}" class="hero__image" loading="eager">
    </div>
  </div>
</section>`;
}

function buildHeroB(imgUrl, imgAlt) {
    // Cinematic: background-image via cssHints, data-bg for reference
    return `<section class="hero hero--cinematic" id="home" data-bg="${imgUrl}">
  <div class="hero__container">
    <h1 class="hero__title">{{HERO_HEADLINE}}</h1>
    <p class="hero__subtitle">{{HERO_SUBTITLE}}</p>
    <a href="#contact" class="hero__cta">{{HERO_CTA}}</a>
    <div class="hero__scroll-indicator">
      <span></span>
    </div>
  </div>
</section>`;
}

function buildHeroC(imgUrl, imgAlt) {
    return `<section class="hero hero--asymmetric" id="home">
  <div class="hero__container">
    <div class="hero__content">
      <h1 class="hero__title">{{HERO_HEADLINE}}</h1>
      <p class="hero__subtitle">{{HERO_SUBTITLE}}</p>
      <a href="#contact" class="hero__cta">{{HERO_CTA}}</a>
    </div>
    <div class="hero__media">
      <img src="${imgUrl}" alt="${imgAlt}" class="hero__image" loading="eager">
    </div>
  </div>
</section>`;
}

function buildHeroD(imgUrl, imgAlt) {
    return `<section class="hero hero--editorial" id="home">
  <div class="hero__media">
    <img src="${imgUrl}" alt="${imgAlt}" class="hero__image" loading="eager">
  </div>
  <div class="hero__container">
    <h1 class="hero__title">{{HERO_HEADLINE}}</h1>
    <p class="hero__subtitle">{{HERO_SUBTITLE}}</p>
    <a href="#contact" class="hero__cta">{{HERO_CTA}}</a>
  </div>
</section>`;
}

function buildHeroE() {
    // Text-only: NO hero image, gradient/solid bg via CSS
    return `<section class="hero hero--textonly" id="home">
  <div class="hero__container">
    <h1 class="hero__title">{{HERO_HEADLINE}}</h1>
    <p class="hero__subtitle">{{HERO_SUBTITLE}}</p>
    <a href="#contact" class="hero__cta">{{HERO_CTA}}</a>
  </div>
</section>`;
}

function buildHeroF(imgUrl, imgAlt) {
    return `<section class="hero hero--cards" id="home">
  <div class="hero__container">
    <div class="hero__content">
      <h1 class="hero__title">{{HERO_HEADLINE}}</h1>
      <p class="hero__subtitle">{{HERO_SUBTITLE}}</p>
      <a href="#contact" class="hero__cta">{{HERO_CTA}}</a>
    </div>
    <div class="hero__cards">
      <div class="hero__card hero__card--1">
        <img src="${imgUrl}" alt="${imgAlt}" class="hero__card-image">
      </div>
      <div class="hero__card hero__card--2"></div>
      <div class="hero__card hero__card--3"></div>
    </div>
  </div>
</section>`;
}

const HERO_BUILDERS = {
    A: buildHeroA,
    B: buildHeroB,
    C: buildHeroC,
    D: buildHeroD,
    E: buildHeroE,
    F: buildHeroF,
};

// ============================================
// CONTENT SECTIONS (1–8)
// ============================================
function buildCardGrid(images) {
    const img1 = safeImage(images, 0);
    const img2 = safeImage(images, 1);
    const img3 = safeImage(images, 2);

    return `<section class="services" id="services">
  <div class="services__container">
    <h2 class="services__title">{{SERVICES_TITLE}}</h2>
    <p class="services__subtitle">{{SERVICES_SUBTITLE}}</p>
    <div class="services__grid">
      <div class="services__card">
        <img src="${img1.url}" alt="${img1.alt}" class="services__card-image" loading="lazy">
        <h3 class="services__card-title">{{SERVICES_CARD1_TITLE}}</h3>
        <p class="services__card-text">{{SERVICES_CARD1_TEXT}}</p>
      </div>
      <div class="services__card">
        <img src="${img2.url}" alt="${img2.alt}" class="services__card-image" loading="lazy">
        <h3 class="services__card-title">{{SERVICES_CARD2_TITLE}}</h3>
        <p class="services__card-text">{{SERVICES_CARD2_TEXT}}</p>
      </div>
      <div class="services__card">
        <img src="${img3.url}" alt="${img3.alt}" class="services__card-image" loading="lazy">
        <h3 class="services__card-title">{{SERVICES_CARD3_TITLE}}</h3>
        <p class="services__card-text">{{SERVICES_CARD3_TEXT}}</p>
      </div>
    </div>
  </div>
</section>`;
}

function buildSplitImageText(images) {
    const img1 = safeImage(images, 0);
    const img2 = safeImage(images, 1);

    return `<section class="about" id="about">
  <div class="about__container">
    <h2 class="about__title">{{ABOUT_TITLE}}</h2>
    <div class="about__row">
      <div class="about__media">
        <img src="${img1.url}" alt="${img1.alt}" class="about__image" loading="lazy">
      </div>
      <div class="about__content">
        <h3 class="about__heading">{{ABOUT_HEADING1}}</h3>
        <p class="about__text">{{ABOUT_TEXT1}}</p>
      </div>
    </div>
    <div class="about__row about__row--reverse">
      <div class="about__media">
        <img src="${img2.url}" alt="${img2.alt}" class="about__image" loading="lazy">
      </div>
      <div class="about__content">
        <h3 class="about__heading">{{ABOUT_HEADING2}}</h3>
        <p class="about__text">{{ABOUT_TEXT2}}</p>
      </div>
    </div>
  </div>
</section>`;
}

function buildFullWidthBreak(images) {
    const img = safeImage(images, 0);
    // Uses background-image via cssHints, data-bg for reference
    return `<section class="showcase" id="showcase" data-bg="${img.url}">
  <div class="showcase__overlay">
    <div class="showcase__container">
      <h2 class="showcase__headline">{{SHOWCASE_HEADLINE}}</h2>
      <p class="showcase__subtitle">{{SHOWCASE_SUBTITLE}}</p>
    </div>
  </div>
</section>`;
}

function buildDarkStats() {
    return `<section class="stats" id="stats">
  <div class="stats__container">
    <h2 class="stats__title">{{STATS_TITLE}}</h2>
    <div class="stats__grid">
      <div class="stats__item">
        <span class="stats__number">{{STATS_1_NUMBER}}</span>
        <span class="stats__label">{{STATS_1_LABEL}}</span>
      </div>
      <div class="stats__item">
        <span class="stats__number">{{STATS_2_NUMBER}}</span>
        <span class="stats__label">{{STATS_2_LABEL}}</span>
      </div>
      <div class="stats__item">
        <span class="stats__number">{{STATS_3_NUMBER}}</span>
        <span class="stats__label">{{STATS_3_LABEL}}</span>
      </div>
      <div class="stats__item">
        <span class="stats__number">{{STATS_4_NUMBER}}</span>
        <span class="stats__label">{{STATS_4_LABEL}}</span>
      </div>
    </div>
  </div>
</section>`;
}

function buildTestimonials() {
    return `<section class="testimonials" id="testimonials">
  <div class="testimonials__container">
    <h2 class="testimonials__title">{{TESTIMONIALS_TITLE}}</h2>
    <div class="testimonials__grid">
      <div class="testimonials__card">
        <blockquote class="testimonials__quote">{{TESTIMONIAL_1_QUOTE}}</blockquote>
        <div class="testimonials__author">
          <span class="testimonials__name">{{TESTIMONIAL_1_NAME}}</span>
          <span class="testimonials__role">{{TESTIMONIAL_1_ROLE}}</span>
        </div>
      </div>
      <div class="testimonials__card">
        <blockquote class="testimonials__quote">{{TESTIMONIAL_2_QUOTE}}</blockquote>
        <div class="testimonials__author">
          <span class="testimonials__name">{{TESTIMONIAL_2_NAME}}</span>
          <span class="testimonials__role">{{TESTIMONIAL_2_ROLE}}</span>
        </div>
      </div>
      <div class="testimonials__card">
        <blockquote class="testimonials__quote">{{TESTIMONIAL_3_QUOTE}}</blockquote>
        <div class="testimonials__author">
          <span class="testimonials__name">{{TESTIMONIAL_3_NAME}}</span>
          <span class="testimonials__role">{{TESTIMONIAL_3_ROLE}}</span>
        </div>
      </div>
    </div>
  </div>
</section>`;
}

function buildBentoGrid(images) {
    const img1 = safeImage(images, 0);
    const img2 = safeImage(images, 1);
    const img3 = safeImage(images, 2);

    return `<section class="gallery" id="gallery">
  <div class="gallery__container">
    <h2 class="gallery__title">{{GALLERY_TITLE}}</h2>
    <p class="gallery__subtitle">{{GALLERY_SUBTITLE}}</p>
    <div class="gallery__grid">
      <div class="gallery__item gallery__item--large">
        <img src="${img1.url}" alt="${img1.alt}" class="gallery__image" loading="lazy">
        <div class="gallery__item-content">
          <h3 class="gallery__item-title">{{GALLERY_ITEM1_TITLE}}</h3>
          <p class="gallery__item-text">{{GALLERY_ITEM1_TEXT}}</p>
        </div>
      </div>
      <div class="gallery__item">
        <img src="${img2.url}" alt="${img2.alt}" class="gallery__image" loading="lazy">
        <div class="gallery__item-content">
          <h3 class="gallery__item-title">{{GALLERY_ITEM2_TITLE}}</h3>
          <p class="gallery__item-text">{{GALLERY_ITEM2_TEXT}}</p>
        </div>
      </div>
      <div class="gallery__item">
        <img src="${img3.url}" alt="${img3.alt}" class="gallery__image" loading="lazy">
        <div class="gallery__item-content">
          <h3 class="gallery__item-title">{{GALLERY_ITEM3_TITLE}}</h3>
          <p class="gallery__item-text">{{GALLERY_ITEM3_TEXT}}</p>
        </div>
      </div>
    </div>
  </div>
</section>`;
}

function buildZigzag(images) {
    const img1 = safeImage(images, 0);
    const img2 = safeImage(images, 1);
    const img3 = safeImage(images, 2);

    return `<section class="process" id="process">
  <div class="process__container">
    <h2 class="process__title">{{PROCESS_TITLE}}</h2>
    <p class="process__subtitle">{{PROCESS_SUBTITLE}}</p>
    <div class="process__items">
      <div class="process__item">
        <div class="process__media">
          <img src="${img1.url}" alt="${img1.alt}" class="process__image" loading="lazy">
        </div>
        <div class="process__content">
          <span class="process__step-number">01</span>
          <h3 class="process__item-title">{{PROCESS_STEP1_TITLE}}</h3>
          <p class="process__item-text">{{PROCESS_STEP1_TEXT}}</p>
        </div>
      </div>
      <div class="process__item process__item--reverse">
        <div class="process__media">
          <img src="${img2.url}" alt="${img2.alt}" class="process__image" loading="lazy">
        </div>
        <div class="process__content">
          <span class="process__step-number">02</span>
          <h3 class="process__item-title">{{PROCESS_STEP2_TITLE}}</h3>
          <p class="process__item-text">{{PROCESS_STEP2_TEXT}}</p>
        </div>
      </div>
      <div class="process__item">
        <div class="process__media">
          <img src="${img3.url}" alt="${img3.alt}" class="process__image" loading="lazy">
        </div>
        <div class="process__content">
          <span class="process__step-number">03</span>
          <h3 class="process__item-title">{{PROCESS_STEP3_TITLE}}</h3>
          <p class="process__item-text">{{PROCESS_STEP3_TEXT}}</p>
        </div>
      </div>
    </div>
  </div>
</section>`;
}

function buildFeatureSpotlight(images) {
    const img = safeImage(images, 0);

    return `<section class="featured" id="featured">
  <div class="featured__container">
    <div class="featured__media">
      <img src="${img.url}" alt="${img.alt}" class="featured__image" loading="lazy">
    </div>
    <div class="featured__content">
      <h2 class="featured__title">{{FEATURED_TITLE}}</h2>
      <p class="featured__subtitle">{{FEATURED_SUBTITLE}}</p>
      <p class="featured__text">{{FEATURED_TEXT}}</p>
      <a href="#contact" class="featured__cta">{{FEATURED_CTA}}</a>
    </div>
  </div>
</section>`;
}

const SECTION_BUILDERS = {
    1: buildCardGrid,
    2: buildSplitImageText,
    3: buildFullWidthBreak,
    4: buildDarkStats,
    5: buildTestimonials,
    6: buildBentoGrid,
    7: buildZigzag,
    8: buildFeatureSpotlight,
};

// ============================================
// ASSEMBLY — build complete skeleton from layout + images
// ============================================
function assembleSkeleton(layout, contextualImages) {
    // 1. Image allocation
    let heroImage = contextualImages[0] || null;
    let contentPool = contextualImages.slice(1);

    // Hero E doesn't use an image — return it to the content pool
    if (layout.hero.id === 'E') {
        if (heroImage) {
            contentPool = [heroImage, ...contentPool];
        }
        heroImage = null;
    }

    // 2. Build hero
    const heroBuilder = HERO_BUILDERS[layout.hero.id];
    let heroHtml;
    if (layout.hero.id === 'E') {
        heroHtml = heroBuilder();
    } else {
        const hImg = heroImage ? { url: heroImage.url, alt: heroImage.alt || 'Hero image' } : safeImage(null, 0);
        heroHtml = heroBuilder(hImg.url, hImg.alt);
    }

    // 3. Build sections, allocating images sequentially from the content pool
    let imageIndex = 0;
    const sectionHtmlParts = [];
    const bgImages = []; // For cssHints

    for (const section of layout.sections) {
        const meta = SECTION_META[section.id];
        const sectionImages = [];

        for (let i = 0; i < meta.imageCount; i++) {
            sectionImages.push(contentPool[imageIndex] || null);
            imageIndex++;
        }

        const builder = SECTION_BUILDERS[section.id];
        if (meta.imageCount === 0) {
            sectionHtmlParts.push(builder());
        } else {
            sectionHtmlParts.push(builder(sectionImages));
        }

        // Track background-image sections for cssHints
        if (section.id === 3 && sectionImages[0]) {
            bgImages.push({ selector: '.showcase', url: sectionImages[0].url });
        }
    }

    // 4. Build nav items from picked sections
    const navItems = layout.sections.map(s => ({
        id: SECTION_META[s.id].id,
        label: SECTION_META[s.id].nav,
    }));

    // 5. Build fixed sections
    const navbarHtml = buildNavbar(navItems);
    const contactHtml = buildContact();
    const footerHtml = buildFooter(navItems);

    // 6. Concatenate skeleton
    const skeleton = [navbarHtml, heroHtml, ...sectionHtmlParts, contactHtml, footerHtml].join('\n\n');

    // 7. Generate cssHints (pre-built CSS for background-image sections)
    const cssHints = [];

    // Hero B needs background-image in CSS
    if (layout.hero.id === 'B' && heroImage) {
        cssHints.push(`.hero--cinematic { background-image: url('${heroImage.url}'); background-size: cover; background-position: center; }`);
    }

    // Full-Width Break needs background-image in CSS
    for (const bg of bgImages) {
        cssHints.push(`${bg.selector} { background-image: url('${bg.url}'); background-size: cover; background-position: center; background-attachment: fixed; }`);
    }

    // 8. Collect all placeholder keys
    const placeholderKeys = getPlaceholderKeys(layout);

    // 9. Collect BEM class names for the prompt
    const bemClasses = collectBemClasses(layout);

    return { skeleton, placeholderKeys, cssHints, bemClasses };
}

// ============================================
// COLLECT BEM CLASSES — tell the AI which classes to target
// ============================================
function collectBemClasses(layout) {
    const classes = [
        // Navbar
        '.navbar, .navbar__container, .navbar__brand, .navbar__toggle, .navbar__toggle-line, .navbar__menu, .navbar__item, .navbar__link',
    ];

    // Hero
    const heroClassMap = {
        A: '.hero.hero--split, .hero__container, .hero__content, .hero__title, .hero__subtitle, .hero__cta, .hero__media, .hero__image',
        B: '.hero.hero--cinematic, .hero__container, .hero__title, .hero__subtitle, .hero__cta, .hero__scroll-indicator',
        C: '.hero.hero--asymmetric, .hero__container, .hero__content, .hero__title, .hero__subtitle, .hero__cta, .hero__media, .hero__image',
        D: '.hero.hero--editorial, .hero__container, .hero__media, .hero__image, .hero__title, .hero__subtitle, .hero__cta',
        E: '.hero.hero--textonly, .hero__container, .hero__title, .hero__subtitle, .hero__cta',
        F: '.hero.hero--cards, .hero__container, .hero__content, .hero__title, .hero__subtitle, .hero__cta, .hero__cards, .hero__card, .hero__card--1, .hero__card--2, .hero__card--3, .hero__card-image',
    };
    classes.push(heroClassMap[layout.hero.id]);

    // Sections
    const sectionClassMap = {
        1: '.services, .services__container, .services__title, .services__subtitle, .services__grid, .services__card, .services__card-image, .services__card-title, .services__card-text',
        2: '.about, .about__container, .about__title, .about__row, .about__row--reverse, .about__media, .about__image, .about__content, .about__heading, .about__text',
        3: '.showcase, .showcase__overlay, .showcase__container, .showcase__headline, .showcase__subtitle',
        4: '.stats, .stats__container, .stats__title, .stats__grid, .stats__item, .stats__number, .stats__label',
        5: '.testimonials, .testimonials__container, .testimonials__title, .testimonials__grid, .testimonials__card, .testimonials__quote, .testimonials__author, .testimonials__name, .testimonials__role',
        6: '.gallery, .gallery__container, .gallery__title, .gallery__subtitle, .gallery__grid, .gallery__item, .gallery__item--large, .gallery__image, .gallery__item-content, .gallery__item-title, .gallery__item-text',
        7: '.process, .process__container, .process__title, .process__subtitle, .process__items, .process__item, .process__item--reverse, .process__media, .process__image, .process__content, .process__step-number, .process__item-title, .process__item-text',
        8: '.featured, .featured__container, .featured__media, .featured__image, .featured__content, .featured__title, .featured__subtitle, .featured__text, .featured__cta',
    };
    for (const section of layout.sections) {
        classes.push(sectionClassMap[section.id]);
    }

    // Contact
    classes.push('.contact, .contact__container, .contact__title, .contact__subtitle, .contact__grid, .contact__form, .contact__form-group, .contact__label, .contact__input, .contact__textarea, .contact__submit, .contact__info, .contact__info-item, .contact__info-title, .contact__info-text');

    // Footer
    classes.push('.footer, .footer__container, .footer__brand, .footer__logo, .footer__tagline, .footer__nav, .footer__link, .footer__social, .footer__social-link, .footer__copyright');

    return classes.join('\n');
}

// ============================================
// PLACEHOLDER KEYS — full list for the given layout
// ============================================
function getPlaceholderKeys(layout) {
    const keys = [...HERO_PLACEHOLDERS];

    for (const section of layout.sections) {
        keys.push(...(SECTION_PLACEHOLDERS[section.id] || []));
    }

    keys.push(...CONTACT_PLACEHOLDERS);
    keys.push(...FOOTER_PLACEHOLDERS);

    return keys;
}

// ============================================
// PLACEHOLDER KEY DESCRIPTIONS — for the AI prompt
// ============================================
function getPlaceholderDescriptions(layout) {
    const descriptions = {
        NAV_BRAND: 'Business name for navigation bar',
        HERO_HEADLINE: 'Compelling main headline (5-10 words)',
        HERO_SUBTITLE: 'Supporting subtitle (1-2 sentences)',
        HERO_CTA: 'Call-to-action button text (2-4 words)',
        SERVICES_TITLE: 'Section heading for services/offerings',
        SERVICES_SUBTITLE: 'Brief section description (1 sentence)',
        SERVICES_CARD1_TITLE: 'First service name',
        SERVICES_CARD1_TEXT: 'First service description (1-2 sentences)',
        SERVICES_CARD2_TITLE: 'Second service name',
        SERVICES_CARD2_TEXT: 'Second service description (1-2 sentences)',
        SERVICES_CARD3_TITLE: 'Third service name',
        SERVICES_CARD3_TEXT: 'Third service description (1-2 sentences)',
        ABOUT_TITLE: 'Section heading for about/story',
        ABOUT_HEADING1: 'First about block heading',
        ABOUT_TEXT1: 'First about block paragraph (2-3 sentences)',
        ABOUT_HEADING2: 'Second about block heading',
        ABOUT_TEXT2: 'Second about block paragraph (2-3 sentences)',
        SHOWCASE_HEADLINE: 'Bold headline for full-width image break',
        SHOWCASE_SUBTITLE: 'Supporting text (1 sentence)',
        STATS_TITLE: 'Section heading for stats/results',
        STATS_1_NUMBER: 'Statistic number (e.g., 500+, 10K, 98%)',
        STATS_1_LABEL: 'Statistic label (2-4 words)',
        STATS_2_NUMBER: 'Statistic number',
        STATS_2_LABEL: 'Statistic label',
        STATS_3_NUMBER: 'Statistic number',
        STATS_3_LABEL: 'Statistic label',
        STATS_4_NUMBER: 'Statistic number',
        STATS_4_LABEL: 'Statistic label',
        TESTIMONIALS_TITLE: 'Section heading for testimonials',
        TESTIMONIAL_1_QUOTE: 'Customer testimonial (2-3 sentences)',
        TESTIMONIAL_1_NAME: 'Customer full name',
        TESTIMONIAL_1_ROLE: 'Customer role/company',
        TESTIMONIAL_2_QUOTE: 'Customer testimonial (2-3 sentences)',
        TESTIMONIAL_2_NAME: 'Customer full name',
        TESTIMONIAL_2_ROLE: 'Customer role/company',
        TESTIMONIAL_3_QUOTE: 'Customer testimonial (2-3 sentences)',
        TESTIMONIAL_3_NAME: 'Customer full name',
        TESTIMONIAL_3_ROLE: 'Customer role/company',
        GALLERY_TITLE: 'Section heading for gallery/showcase',
        GALLERY_SUBTITLE: 'Brief section description (1 sentence)',
        GALLERY_ITEM1_TITLE: 'First gallery item title',
        GALLERY_ITEM1_TEXT: 'First gallery item description (1 sentence)',
        GALLERY_ITEM2_TITLE: 'Second gallery item title',
        GALLERY_ITEM2_TEXT: 'Second gallery item description (1 sentence)',
        GALLERY_ITEM3_TITLE: 'Third gallery item title',
        GALLERY_ITEM3_TEXT: 'Third gallery item description (1 sentence)',
        PROCESS_TITLE: 'Section heading for process/how-it-works',
        PROCESS_SUBTITLE: 'Brief section description (1 sentence)',
        PROCESS_STEP1_TITLE: 'Step 1 title',
        PROCESS_STEP1_TEXT: 'Step 1 description (1-2 sentences)',
        PROCESS_STEP2_TITLE: 'Step 2 title',
        PROCESS_STEP2_TEXT: 'Step 2 description (1-2 sentences)',
        PROCESS_STEP3_TITLE: 'Step 3 title',
        PROCESS_STEP3_TEXT: 'Step 3 description (1-2 sentences)',
        FEATURED_TITLE: 'Feature spotlight heading',
        FEATURED_SUBTITLE: 'Feature spotlight subtitle',
        FEATURED_TEXT: 'Detailed feature description (2-3 sentences)',
        FEATURED_CTA: 'Feature CTA text (2-4 words)',
        CONTACT_TITLE: 'Contact section heading',
        CONTACT_SUBTITLE: 'Contact section subtitle (1 sentence)',
        CONTACT_CTA: 'Form submit button text (2-3 words)',
        CONTACT_ADDRESS: 'Business address',
        CONTACT_PHONE: 'Business phone number',
        CONTACT_EMAIL: 'Business email address',
        FOOTER_BRAND: 'Business name for footer',
        FOOTER_TAGLINE: 'Brand tagline (1 short sentence)',
    };

    const keys = getPlaceholderKeys(layout);
    return keys.map(key => `- ${key}: ${descriptions[key] || key}`).join('\n');
}

// ============================================
// REPLACE PLACEHOLDERS — inject content into skeleton
// ============================================
function replacePlaceholders(skeleton, contentMap) {
    let result = skeleton;
    let replaced = 0;
    let missing = [];

    for (const [key, value] of Object.entries(contentMap)) {
        const placeholder = `{{${key}}}`;
        if (result.includes(placeholder)) {
            // Strip HTML tags from content values (XSS prevention)
            const safeValue = String(value).replace(/<[^>]*>/g, '');
            result = result.split(placeholder).join(safeValue);
            replaced++;
        }
    }

    // Check for unreplaced placeholders
    const unreplaced = result.match(/\{\{[A-Z_0-9]+\}\}/g);
    if (unreplaced) {
        missing = [...new Set(unreplaced)];
        console.warn(`⚠️ Unreplaced placeholders (${missing.length}): ${missing.join(', ')}`);
        // Remove unreplaced placeholders to avoid broken display
        for (const ph of missing) {
            result = result.split(ph).join('');
        }
    }

    console.log(`✅ Replaced ${replaced} placeholders, ${missing.length} missing`);
    return result;
}

module.exports = {
    SECTION_META,
    assembleSkeleton,
    replacePlaceholders,
    getPlaceholderKeys,
    getPlaceholderDescriptions,
};
