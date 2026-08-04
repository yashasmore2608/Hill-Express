/**
 * Demo seed — Shimla, one store, one driver, 8 categories, 24 products.
 * Idempotent: safe to run repeatedly (upserts keyed on unique fields).
 *
 *   node --env-file=.env prisma/seed.cjs      (from apps/api)
 *
 * Dev login numbers:
 *   POS    +919999900001  (store phone)
 *   DRIVER +919999900002
 *   Customer: any valid number — accounts auto-create on OTP verify.
 */
const { PrismaClient } = require('@prisma/client');
const { randomBytes, scryptSync } = require('node:crypto');

// Real product photos (Open Food Facts pack shots + Wikimedia Commons produce),
// each URL verified live when generated. Products with no entry fall back to
// the category emoji tile in the app — a missing photo is never a broken image.
// NOTE: these are hotlinked for the demo seed only. Production uploads to R2
// (presigned direct upload) so we never depend on a third-party CDN.
const IMAGES = require('./product-images.json');

const prisma = new PrismaClient();

const rupees = (r) => Math.round(r * 100); // paise

// Mirrors src/config/secrets.ts hashPassword — seed stays dependency-free.
const hashPassword = (password) => {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
};

async function main() {
  // ── Zone ────────────────────────────────────────────────────────────
  let zone = await prisma.deliveryZone.findFirst({ where: { name: 'Shimla Central' } });
  if (!zone) {
    zone = await prisma.deliveryZone.create({
      data: {
        name: 'Shimla Central',
        pincodes: ['171001', '171002', '171003'],
        centerLat: 31.1048,
        centerLng: 77.1734,
        radiusKm: 6,
      },
    });
  }

  // ── Hill-tuned ETA constants (zone default) ─────────────────────────
  await prisma.deliveryConfig.upsert({
    where: { zoneId: zone.id },
    update: {},
    create: { zoneId: zone.id }, // schema defaults ARE the hill defaults
  });

  // ── Store ───────────────────────────────────────────────────────────
  const store = await prisma.store.upsert({
    where: { code: 'HE-STORE-001' },
    update: {},
    create: {
      code: 'HE-STORE-001',
      name: 'Hill Express — Mall Road',
      phone: '+919999900001',
      addressLine: '12 Mall Road, Shimla, HP 171001',
      lat: 31.1048,
      lng: 77.1734,
      elevationM: 2200,
      zoneId: zone.id,
      isOpen: true,
      deliveryFeePaise: rupees(20),
      freeDeliveryAbovePaise: rupees(499),
      openTime: '08:00',
      closeTime: '21:00',
      defaultPrepMin: 15,
    },
  });

  // ── Driver ──────────────────────────────────────────────────────────
  await prisma.driver.upsert({
    where: { phone: '+919999900002' },
    update: {},
    create: {
      phone: '+919999900002',
      name: 'Ravi Kumar',
      status: 'AVAILABLE',
      vehicleNumber: 'HP-03-1234',
      codLimitPaise: rupees(5000),
    },
  });

  // ── Admin (dev login: admin@hillexpress.in / hillexpress-dev) ───────
  const adminEmail = 'admin@hillexpress.in';
  const existingAdmin = await prisma.adminUser.findUnique({ where: { email: adminEmail } });
  if (!existingAdmin) {
    await prisma.adminUser.create({
      data: {
        email: adminEmail,
        name: 'Ops Admin',
        passwordHash: hashPassword('hillexpress-dev'),
        role: 'SUPER',
      },
    });
  }

  // ── Categories ──────────────────────────────────────────────────────
  const categoryNames = [
    'Fruits & Vegetables',
    'Dairy, Bread & Eggs',
    'Atta, Rice & Dal',
    'Masala & Oil',
    'Snacks & Biscuits',
    'Beverages',
    'Household Essentials',
    'Personal Care',
  ];
  const categories = {};
  for (const [i, name] of categoryNames.entries()) {
    let cat = await prisma.category.findFirst({ where: { storeId: store.id, name } });
    if (!cat) {
      cat = await prisma.category.create({
        data: { storeId: store.id, name, sortOrder: i },
      });
    }
    categories[name] = cat;
  }

  // ── Products ────────────────────────────────────────────────────────
  // [sku, name, category, unit, packSize, price₹, mrp₹|null, stock]
  const products = [
    ['FV-001', 'Palak (Spinach), bunch', 'Fruits & Vegetables', 'PIECE', '1 bunch', 32, null, 40],
    ['FV-002', 'Tomato Hybrid', 'Fruits & Vegetables', 'KG', '1 kg', 48, null, 60],
    ['FV-003', 'Onion', 'Fruits & Vegetables', 'KG', '1 kg', 38, null, 80],
    ['FV-004', 'Potato (Pahadi)', 'Fruits & Vegetables', 'KG', '1 kg', 42, null, 90],
    ['FV-005', 'Shimla Apple', 'Fruits & Vegetables', 'KG', '1 kg', 149, 180, 45],
    ['FV-006', 'Coriander, bunch', 'Fruits & Vegetables', 'PIECE', '1 bunch', 15, null, 35],
    ['DA-001', 'Amul Taaza Toned Milk', 'Dairy, Bread & Eggs', 'ML', '500 ml', 27, null, 120],
    ['DA-002', 'Amul Butter', 'Dairy, Bread & Eggs', 'G', '100 g', 62, null, 40],
    ['DA-003', 'Farm Eggs', 'Dairy, Bread & Eggs', 'PACK', '6 pcs', 54, 60, 55],
    ['DA-004', 'Brown Bread', 'Dairy, Bread & Eggs', 'PACK', '400 g', 45, null, 25],
    ['DA-005', 'Amul Masti Dahi', 'Dairy, Bread & Eggs', 'G', '400 g', 42, null, 30],
    ['AT-001', 'Aashirvaad Select Atta', 'Atta, Rice & Dal', 'KG', '5 kg', 315, 348, 22],
    ['AT-002', 'India Gate Basmati Rice', 'Atta, Rice & Dal', 'KG', '1 kg', 129, 155, 30],
    ['AT-003', 'Toor Dal (Unpolished)', 'Atta, Rice & Dal', 'KG', '1 kg', 168, 185, 28],
    ['MO-001', 'Fortune Kachi Ghani Mustard Oil', 'Masala & Oil', 'LITRE', '1 L', 172, 195, 26],
    ['MO-002', 'Everest Garam Masala', 'Masala & Oil', 'G', '100 g', 78, 84, 32],
    ['SN-001', 'Parle-G Gold', 'Snacks & Biscuits', 'G', '500 g', 52, 55, 70],
    ['SN-002', 'Lays India’s Magic Masala', 'Snacks & Biscuits', 'G', '73 g', 20, null, 85],
    ['SN-003', 'Haldiram Bhujia', 'Snacks & Biscuits', 'G', '200 g', 55, 60, 48],
    ['BV-001', 'Tata Tea Premium', 'Beverages', 'G', '250 g', 145, 160, 36],
    ['BV-002', 'Nescafe Classic', 'Beverages', 'G', '45 g', 165, 180, 20],
    ['HH-001', 'Vim Dishwash Bar', 'Household Essentials', 'PACK', '3 × 150 g', 63, 72, 44],
    ['HH-002', 'Surf Excel Easy Wash', 'Household Essentials', 'KG', '1 kg', 138, 150, 33],
    ['PC-001', 'Dettol Original Soap', 'Personal Care', 'PACK', '4 × 75 g', 152, 172, 38],
  ];

  for (const [sku, name, catName, unit, packSize, price, mrp, stock] of products) {
    const imageUrl = IMAGES[sku] ?? null;
    await prisma.product.upsert({
      where: { storeId_sku: { storeId: store.id, sku } },
      // Images are re-applied on every run so a refreshed URL map takes effect
      // without wiping operator-edited prices or stock.
      update: { imageUrl },
      create: {
        storeId: store.id,
        sku,
        name,
        categoryId: categories[catName].id,
        unit,
        packSize,
        pricePaise: rupees(price),
        mrpPaise: mrp ? rupees(mrp) : null,
        stockQty: stock,
        lowStockAt: 5,
        isAvailable: true,
        imageUrl,
      },
    });
    // Append-only ledger: seed stock is an IMPORT event, provable like any other.
    const existing = await prisma.stockLedger.findFirst({
      where: { storeId: store.id, reason: 'IMPORT', note: `seed:${sku}` },
    });
    if (!existing) {
      const p = await prisma.product.findUnique({
        where: { storeId_sku: { storeId: store.id, sku } },
      });
      await prisma.stockLedger.create({
        data: {
          productId: p.id,
          storeId: store.id,
          delta: stock,
          reason: 'IMPORT',
          actorType: 'SYSTEM',
          note: `seed:${sku}`,
        },
      });
    }
  }

  // ── Demo promo banners (idempotent on title) ────────────────────────
  const fruitCat = categories['Fruits & Vegetables'];
  const banners = [
    {
      title: 'Fresh from the hills',
      subtitle: 'Shimla apples picked this morning',
      bgColor: '#0B3D2E',
      ctaLabel: 'Shop produce',
      linkType: 'CATEGORY',
      linkValue: fruitCat?.id ?? null,
      sortOrder: 0,
    },
    {
      title: 'Free delivery over ₹499',
      subtitle: 'No coupon needed — it just applies at checkout',
      bgColor: '#D4661F',
      ctaLabel: 'Start shopping',
      linkType: 'SEARCH',
      linkValue: 'atta',
      sortOrder: 1,
    },
    {
      title: 'Pay when it arrives',
      subtitle: 'Cash on delivery on every order',
      bgColor: '#16704F',
      linkType: 'NONE',
      linkValue: null,
      sortOrder: 2,
    },
  ];
  for (const b of banners) {
    const existing = await prisma.banner.findFirst({ where: { title: b.title } });
    if (!existing) await prisma.banner.create({ data: b });
  }

  const counts = {
    zones: await prisma.deliveryZone.count(),
    stores: await prisma.store.count(),
    drivers: await prisma.driver.count(),
    categories: await prisma.category.count(),
    products: await prisma.product.count(),
    stockLedger: await prisma.stockLedger.count(),
    withPhotos: await prisma.product.count({ where: { imageUrl: { not: null } } }),
    banners: await prisma.banner.count(),
  };
  console.log('Seed complete:', JSON.stringify(counts));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
