---
rule: clean-code/mobile-optimization
title: Mobile Optimization Patterns
category: clean-code
scope: [general]
priority: recommended
applies-to: [typescript, javascript, react]
tags: [mobile, responsive, tailwind, touch, progressive-enhancement, UX]
---

# Mobile Optimization Patterns

**Goal**: Excellent UX on mobile with DRY, maintainable code.

---

## Core Principles

1. **DRY Responsive Spacing**: Centralize all spacing values
2. **30-40% Mobile Reduction**: Less padding/margin on small screens
3. **Mobile-First**: Base styles for mobile, `md:` modifiers for desktop
4. **Progressive Enhancement**: Mobile gets essentials, desktop gets extras

---

## DRY Responsive Spacing

**What**: Centralize all responsive spacing in constants.
**Why**: Single source of truth, consistent reduction, easy to maintain.

```typescript
// BAD: Magic numbers scattered
<section className="py-20 mb-20">
<section className="py-16 mb-16">
<section className="py-12 mb-12">

// GOOD: DRY constants
// constants/responsive-spacing.ts
export const SECTION_PADDING = {
  mobile: 'py-12',
  desktop: 'md:py-20',
} as const;

export const SECTION_MARGIN = {
  mobile: 'mb-12',
  desktop: 'md:mb-20',
} as const;

export type ResponsiveSpacingToken = {
  mobile: string;
  desktop: string;
};

export function combineSpacing(token: ResponsiveSpacingToken): string {
  return `${token.mobile} ${token.desktop}`;
}

// Usage
const padding = combineSpacing(SECTION_PADDING); // "py-12 md:py-20"
```

**Benefits**: Change globally in one place, type-safe, 30-40% mobile reduction.

---

## Responsive Carousel Component

**What**: Show different layouts based on screen size.
**Why**: Optimal UX for each device type.

```tsx
// OCP-compliant generic carousel
export function ResponsiveCarousel<T>({
  items,
  renderCard,
  desktopColumns = 3,
}: ResponsiveCarouselProps<T>) {
  if (!items || items.length === 0) return null; // Early return guard

  return (
    <>
      {/* Mobile: Horizontal scroll */}
      <div className="lg:hidden overflow-x-auto snap-x snap-mandatory flex gap-4 pb-4">
        {items.map((item, index) => (
          <div key={index} className="snap-start flex-shrink-0 w-[85%]">
            {renderCard(item, index)}
          </div>
        ))}
      </div>

      {/* Desktop: Grid */}
      <div className={`hidden lg:grid lg:grid-cols-${desktopColumns} gap-6`}>
        {items.map((item, index) => renderCard(item, index))}
      </div>
    </>
  );
}

// Usage with ANY type
<ResponsiveCarousel
  items={pillars}
  renderCard={(pillar) => <PillarCard {...pillar} />}
  desktopColumns={4}
/>
```

---

## Dual Mobile/Desktop Strategy

**What**: Show different UI elements based on screen size.
**Why**: Optimal placement for each device.

```tsx
// Mobile: OrderBox at top + sticky CTA at bottom
// Desktop: Sticky sidebar OrderBox

function ProductPage() {
  return (
    <div className="flex flex-col lg:flex-row gap-8">
      {/* Main Content */}
      <main className="lg:w-2/3">
        {/* Mobile OrderBox (lg:hidden) */}
        <div className="lg:hidden mb-8" id="order-box-mobile-top">
          <OrderBox />
        </div>

        <ProductDetails />
        <ProductFeatures />
      </main>

      {/* Desktop Sidebar (hidden lg:block) */}
      <aside className="hidden lg:block lg:w-1/3">
        <div className="sticky top-24">
          <OrderBox />
        </div>
      </aside>

      {/* Mobile Sticky CTA (lg:hidden) */}
      <MobileCtaButton targetId="order-box-mobile-top" />
    </div>
  );
}
```

---

## Smooth Scroll Hook (DRY + SRP)

**What**: Extract reusable scroll behavior.
**Why**: DRY (reuse logic), SRP (hook manages one thing), testable.

```typescript
// hooks/useSmoothScroll.ts
export function useSmoothScroll(options = {}) {
  const { offset = 0 } = options;

  const scrollTo = useCallback((targetId: string) => {
    if (!targetId) return; // Guard
    const element = document.getElementById(targetId);
    if (!element) return; // Guard

    const offsetPosition = 
      element.getBoundingClientRect().top + window.pageYOffset - offset;
    
    window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
  }, [offset]);

  return { scrollTo };
}

// Reused in multiple components
function MobileCtaButton({ targetId }: Props) {
  const { scrollTo } = useSmoothScroll({ offset: 80 });

  return (
    <button 
      className="fixed bottom-4 left-4 right-4 lg:hidden"
      onClick={() => scrollTo(targetId)}
    >
      Get Started
    </button>
  );
}
```

---

## Progressive Typography

**What**: Scale text progressively across breakpoints.
**Why**: Readable on all screen sizes.

```tsx
// GOOD: Progressive scaling
<h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold">
  Welcome
</h1>

<p className="text-base md:text-lg lg:text-xl text-muted-foreground">
  Discover your authentic self
</p>

// BAD: Fixed size or extreme jumps
<h1 className="text-6xl">Too big on mobile!</h1>
<h1 className="text-xl md:text-6xl">Jump too extreme!</h1>
```

---

## Image Height Constraints

**What**: Constrain image heights on mobile.
**Why**: Prevent oversized images consuming viewport.

```tsx
// GOOD: Constrained on mobile, flexible on desktop
<img 
  src={heroImage} 
  className="w-full max-h-[400px] md:max-h-none object-cover"
  alt="Hero"
/>

// GOOD: Aspect ratio container
<div className="aspect-[16/9] md:aspect-[21/9] overflow-hidden">
  <img src={heroImage} className="w-full h-full object-cover" alt="Hero" />
</div>
```

---

## Touch-Friendly Interactions

**What**: Larger touch targets, swipe-friendly carousels.
**Why**: Mobile users use fingers, not cursors.

```tsx
// Touch targets minimum 44x44px
<button className="min-h-[44px] min-w-[44px] p-3">
  <Icon />
</button>

// Swipe-friendly carousel
<div className="overflow-x-auto snap-x snap-mandatory touch-pan-x">
  {items.map(item => (
    <div key={item.id} className="snap-start">
      <Card />
    </div>
  ))}
</div>
```

---

## Mobile-First Class Order

```tsx
// GOOD: Mobile-first (base -> sm -> md -> lg -> xl)
<div className="
  p-4                  // Mobile base
  sm:p-6               // Small screens
  md:p-8               // Medium screens
  lg:p-10              // Large screens
  xl:p-12              // Extra large
">

// BAD: Desktop-first (harder to reason about)
<div className="p-12 xl:p-12 lg:p-10 md:p-8 sm:p-6">
```

---

## Checklist

Before merging mobile-related code:

- [ ] Using DRY spacing constants (not magic numbers)?
- [ ] 30-40% mobile reduction applied (py-12 -> py-20)?
- [ ] Responsive carousels (scroll on mobile -> grid on desktop)?
- [ ] Dual strategy for key CTAs (mobile sticky + desktop sidebar)?
- [ ] Image heights constrained on mobile?
- [ ] Typography scales progressively?
- [ ] Touch targets minimum 44x44px?
- [ ] Mobile-first class order?
- [ ] Components under 150 LOC?
