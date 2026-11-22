import { slugify } from "@/src/lib/format";

const img = (id: string) => `/media/${id}.webp`;
export const demoCategories = [
  [
    "audio",
    "Audio",
    "Słuchawki i głośniki do pracy, podróży i odpoczynku.",
    ["Czas pracy", "Redukcja hałasu"],
  ],
  [
    "klawiatury",
    "Klawiatury",
    "Mechaniczne klawiatury do pisania, pracy i grania.",
    ["Układ", "Przełączniki"],
  ],
  [
    "myszy",
    "Myszy",
    "Ergonomiczne i lekkie myszy do codziennych zadań.",
    ["Czułość", "Waga"],
  ],
  [
    "monitory",
    "Monitory",
    "Wyraźny obraz do tworzenia, pracy i rozrywki.",
    ["Przekątna", "Rozdzielczość", "Odświeżanie"],
  ],
  [
    "stanowisko",
    "Stanowisko",
    "Podstawki i akcesoria, które porządkują biurko.",
    ["Materiał"],
  ],
  [
    "ladowanie",
    "Ładowanie",
    "Ładowarki, huby i przewody do Twojego sprzętu.",
    ["Moc", "Złącza"],
  ],
].map(([id, name, description, facets], position) => ({
  id: id as string,
  slug: id as string,
  name: name as string,
  description: description as string,
  image: img(id as string),
  position,
  facets: facets as string[],
  active: true,
  parentId: null,
}));

type Entry = [
  name: string,
  price: number,
  sale: number | null,
  summary: string,
  first: string,
  second?: string,
  third?: string,
];
const entries: Entry[][] = [
  [
    [
      "Studio Pro Wireless",
      499,
      399,
      "Słuchawki wokółuszne z aktywną redukcją szumów i przestrzenną sceną dźwiękową.",
      "40 h",
      "ANC",
    ],
    [
      "Sound One",
      299,
      null,
      "Lekkie słuchawki nauszne ze składanym pałąkiem do codziennych dojazdów.",
      "32 h",
      "Pasywna",
    ],
    [
      "Orbit Buds",
      249,
      199,
      "Kompaktowe słuchawki douszne z etui ładowanym przez USB-C.",
      "24 h",
      "ANC",
    ],
    [
      "Pulse Speaker",
      359,
      null,
      "Przenośny głośnik stereo z odporną na zachlapania obudową.",
      "16 h",
      "Brak",
    ],
    [
      "Studio Air",
      599,
      null,
      "Bezprzewodowe słuchawki z miękkimi nausznikami i trybem transparentnym.",
      "50 h",
      "ANC",
    ],
    [
      "Wave Mini",
      169,
      null,
      "Mały głośnik Bluetooth do biurka i krótkich wyjazdów.",
      "10 h",
      "Brak",
    ],
    [
      "Focus Headset",
      229,
      null,
      "Zestaw z mikrofonem kierunkowym do wideokonferencji i rozmów.",
      "Zasilanie USB",
      "Pasywna",
    ],
    [
      "Bass Loop",
      279,
      null,
      "Sportowe słuchawki z bezpiecznym mocowaniem za uchem.",
      "28 h",
      "Pasywna",
    ],
  ],
  [
    [
      "Keyboard K75",
      349,
      289,
      "Kompaktowa klawiatura mechaniczna z układem 75% i wygodnym pokrętłem głośności.",
      "75%",
      "Linear",
    ],
    [
      "Keyboard K96",
      429,
      null,
      "Pełny blok numeryczny w kompaktowej obudowie z podświetleniem.",
      "96%",
      "Tactile",
    ],
    [
      "Keystroke TKL",
      329,
      null,
      "Klawiatura bez bloku numerycznego, z przełącznikami hot-swap.",
      "80%",
      "Tactile",
    ],
    [
      "Keystroke Mini",
      269,
      239,
      "Minimalistyczna klawiatura mechaniczna z odpinanym przewodem.",
      "60%",
      "Linear",
    ],
    [
      "Flow Low Profile",
      389,
      null,
      "Smukła klawiatura mechaniczna do pisania na kilku urządzeniach.",
      "75%",
      "Low profile",
    ],
    [
      "Canvas Silent",
      449,
      null,
      "Wyciszone przełączniki mechaniczne do wspólnych przestrzeni.",
      "80%",
      "Silent",
    ],
    [
      "Frame 65",
      369,
      null,
      "Kompaktowy układ ze strzałkami i aluminiową płytą.",
      "65%",
      "Linear",
    ],
    [
      "Studio Keys",
      499,
      449,
      "Klawiatura z profilami podświetlenia i programowalnymi klawiszami.",
      "100%",
      "Tactile",
    ],
  ],
  [
    [
      "Mouse Air X",
      179,
      null,
      "Lekka mysz bezprzewodowa z precyzyjnym sensorem i ergonomicznym profilem.",
      "12 000 DPI",
      "64 g",
    ],
    [
      "Mouse Air Lite",
      139,
      null,
      "Bezprzewodowa mysz podróżna z cichymi przyciskami.",
      "4 000 DPI",
      "58 g",
    ],
    [
      "Ergo Lift",
      229,
      199,
      "Pionowa mysz wspierająca naturalne ułożenie przedramienia.",
      "4 000 DPI",
      "108 g",
    ],
    [
      "Pixel Pro",
      319,
      null,
      "Mysz do grania z lekką obudową i niskim opóźnieniem.",
      "26 000 DPI",
      "55 g",
    ],
    [
      "Glide Track",
      249,
      null,
      "Trackball do precyzyjnej pracy na małym biurku.",
      "3 200 DPI",
      "135 g",
    ],
    [
      "Mouse Core",
      89,
      69,
      "Prosta przewodowa mysz optyczna z symetrycznym kształtem.",
      "2 400 DPI",
      "77 g",
    ],
    [
      "Air Arc",
      199,
      null,
      "Kompaktowa mysz Bluetooth, którą łatwo przenosić.",
      "3 200 DPI",
      "62 g",
    ],
    [
      "Glide Studio",
      269,
      null,
      "Mysz z poziomym przewijaniem do pracy w aplikacjach kreatywnych.",
      "8 000 DPI",
      "94 g",
    ],
  ],
  [
    [
      "Display V27",
      1299,
      1149,
      "Monitor QHD z matrycą IPS i podstawą o regulowanej wysokości.",
      "27″",
      "2560 × 1440",
      "165 Hz",
    ],
    [
      "Display V24",
      699,
      null,
      "Kompaktowy ekran Full HD z cienkimi ramkami.",
      "24″",
      "1920 × 1080",
      "100 Hz",
    ],
    [
      "Display V32",
      2299,
      null,
      "Ekran 4K do montażu, tworzenia i pracy z kilkoma aplikacjami.",
      "32″",
      "3840 × 2160",
      "144 Hz",
    ],
    [
      "View Ultra 34",
      1899,
      1699,
      "Zakrzywiony ekran ultrapanoramiczny do pracy i rozrywki.",
      "34″",
      "3440 × 1440",
      "144 Hz",
    ],
    [
      "View Color 27",
      1599,
      null,
      "Monitor IPS o rozszerzonej palecie barw do obróbki zdjęć.",
      "27″",
      "3840 × 2160",
      "60 Hz",
    ],
    [
      "Display Move",
      799,
      null,
      "Przenośny ekran z pojedynczym przewodem USB-C.",
      "16″",
      "1920 × 1200",
      "60 Hz",
    ],
    [
      "View Game 25",
      999,
      null,
      "Monitor o wysokim odświeżaniu do szybkiej rozgrywki.",
      "25″",
      "1920 × 1080",
      "240 Hz",
    ],
    [
      "Display V27 Office",
      899,
      null,
      "Ekran QHD z trybem ograniczającym emisję niebieskiego światła.",
      "27″",
      "2560 × 1440",
      "75 Hz",
    ],
  ],
  [
    [
      "Lift Desk Stand",
      199,
      null,
      "Aluminiowa podstawka, która unosi laptop do wygodnej wysokości.",
      "Aluminium",
    ],
    [
      "Lift Travel",
      129,
      null,
      "Składana podstawka z regulacją kąta i antypoślizgowymi stopkami.",
      "Aluminium",
    ],
    [
      "Desk Mat Felt",
      99,
      79,
      "Filcowa mata chroniąca blat i tłumiąca odgłosy klawiatury.",
      "Filc",
    ],
    [
      "Studio Arm",
      299,
      null,
      "Regulowane ramię do monitora z uchwytem VESA.",
      "Stal",
    ],
    [
      "Cable Dock",
      49,
      null,
      "Organizer zapobiegający zsuwaniu się przewodów z biurka.",
      "Silikon",
    ],
    [
      "Desk Shelf",
      329,
      null,
      "Półka pod monitor z miejscem na klawiaturę i akcesoria.",
      "Drewno",
    ],
    [
      "Lift Vertical",
      149,
      null,
      "Pionowy uchwyt z regulowaną szerokością na dwa urządzenia.",
      "Aluminium",
    ],
    [
      "Wrist Rest 75",
      69,
      null,
      "Podpórka pod nadgarstki do klawiatur kompaktowych.",
      "Pianka",
    ],
  ],
  [
    [
      "Dock USB-C 8",
      279,
      null,
      "Hub 8 w 1 z HDMI, czytnikiem kart i zasilaniem przelotowym.",
      "100 W",
      "HDMI, USB-C, USB-A, SD",
    ],
    [
      "Charge GaN 65",
      169,
      139,
      "Ładowarka sieciowa z dwoma portami USB-C i wydajną technologią GaN.",
      "65 W",
      "USB-C",
    ],
    [
      "Charge GaN 100",
      249,
      null,
      "Ładowarka z trzema wyjściami do laptopa, telefonu i akcesoriów.",
      "100 W",
      "USB-C, USB-A",
    ],
    [
      "Cable Flex 2 m",
      59,
      null,
      "Przewód w oplocie z obsługą USB Power Delivery.",
      "100 W",
      "USB-C",
    ],
    [
      "Dock USB-C 5",
      159,
      null,
      "Mały hub do laptopa z trzema portami USB-A i HDMI.",
      "60 W",
      "HDMI, USB-A, USB-C",
    ],
    [
      "Charge Pocket 30",
      99,
      null,
      "Kompaktowy zasilacz do szybkiego ładowania telefonu.",
      "30 W",
      "USB-C",
    ],
    [
      "Cable Video 4K",
      89,
      null,
      "Przewód USB-C do monitora z obsługą DisplayPort Alt Mode.",
      "60 W",
      "USB-C",
    ],
    [
      "Power Bank 10K",
      179,
      null,
      "Przenośna ładowarka o pojemności 10 000 mAh.",
      "20 W",
      "USB-C, USB-A",
    ],
  ],
];

const modelPhotos: Record<string, string> = {
  "orbit-buds": "orbit-buds",
  "pulse-speaker": "pulse-speaker",
  "wave-mini": "pulse-speaker",
  "ergo-lift": "ergo-lift",
  "desk-mat-felt": "desk-mat-felt",
  "studio-arm": "studio-arm",
  "lift-vertical": "lift-vertical",
  "charge-gan-65": "charge-gan",
  "charge-gan-100": "charge-gan",
  "charge-pocket-30": "charge-gan",
  "cable-flex-2-m": "usb-cable",
  "cable-video-4k": "usb-cable",
  "power-bank-10k": "power-bank",
};

export const demoProducts = entries.flatMap((group, family) =>
  group.map(([name, price, sale, summary, ...specs], i) => {
    const category = demoCategories[family];
    const id = slugify(name);
    const cover = modelPhotos[id] ? img(modelPhotos[id]) : category.image;
    const brand =
      family === 1 && i > 4
        ? "KEYFRAME"
        : family === 5 && i > 2
          ? "VOLTIX"
          : "NEXORA";
    const hero = family === 0 && i === 0;
    const createdAt = new Date(Date.UTC(2026, 8, 20 + family * 5 + i));
    const variants = (
      hero
        ? ["Czarny", "Biały", "Fioletowy"]
        : i % 3 === 0 && family !== 3
          ? ["Czarny", "Biały"]
          : [family === 1 ? "Biały" : "Czarny"]
    ).map((color, k) => ({
      id: `${id}-${slugify(color)}`,
      productId: id,
      name: color,
      color,
      sku: `NX-${family + 1}${String(i + 1).padStart(2, "0")}-${["A", "B", "C"][k]}`,
      connection:
        family < 3 && !name.includes("Core") && !name.includes("Headset")
          ? "Bezprzewodowa"
          : "Przewodowa",
      price: (price + (k === 2 ? 20 : 0)) * 100,
      salePrice: sale ? (sale + (k === 2 ? 20 : 0)) * 100 : null,
      saleStart: null,
      saleEnd: null,
      position: k,
      active: true,
      stock: hero
        ? [12, 7, 0][k]
        : i === 6 && family % 2 === 0
          ? 0
          : 6 + ((i * 7 + family * 3 + k * 11) % 26),
      image:
        hero && k > 0
          ? img(k === 1 ? "studio-white" : "studio-violet")
          : cover,
    }));
    return {
      id,
      slug: id,
      name,
      brand,
      categoryId: category.id,
      summary,
      description: `${summary} ${
        [
          "Dopasuj brzmienie do miejsca, w którym słuchasz. Elementy sterujące są dostępne bez sięgania po telefon.",
          "Rozkład klawiszy ułatwia pisanie bez zajmowania całej szerokości biurka. Powierzchnia nasadek zapewnia pewne oparcie palcom.",
          "Wyprofilowana obudowa prowadzi dłoń, a łatwe do rozróżnienia przyciski pozwalają szybko zmieniać ustawienia.",
          "Matowa powierzchnia ogranicza odbicia. Ekran sprawdzi się przy pracy z tekstem i materiałami wideo.",
          "Akcesorium ułatwia organizację stanowiska, a wykończenie pozwala szybko wyczyścić powierzchnię.",
          "Kompaktowa obudowa sprawdza się przy pracy poza domem. Przed zakupem porównaj wymagania urządzenia z parametrami poniżej.",
        ][family]
      }`,
      specifications: Object.fromEntries(
        category.facets.map((facet, k) => [facet, specs[k] ?? "—"]),
      ),
      box: hero
        ? "Słuchawki, etui podróżne, przewód USB-C, dokumentacja"
        : `${name}, dokumentacja`,
      status: "active" as const,
      featured: i === 0 && family < 4,
      tax: 23,
      createdAt,
      metaTitle: null,
      metaDescription: null,
      ogImage: null,
      images: [
        { url: cover, alt: name, position: 0 },
        ...(hero
          ? [
              {
                url: img("studio-hero"),
                alt: "Studio Pro Wireless w świetle studyjnym",
                position: 1,
              },
            ]
          : []),
      ],
      variants,
      rating: 0,
      reviewCount: 0,
      sold: 0,
    };
  }),
);

export const demoReviews = [
  {
    productId: "studio-pro-wireless",
    author: "Marta",
    title: "Spokój w open space",
    body: "Doceniam miękkie nauszniki i to, że mogę przełączyć tryb bez sięgania po telefon.",
    rating: 5,
  },
  {
    productId: "keyboard-k75",
    author: "Kamil",
    title: "Więcej miejsca na biurku",
    body: "Układ 75% ma wszystko, czego potrzebuję. Pokrętła głośności używam kilka razy dziennie.",
    rating: 5,
  },
  {
    productId: "mouse-air-x",
    author: "Natalia",
    title: "Lekka i wygodna",
    body: "Dobrze leży w dłoni. Przełączanie między laptopem a komputerem jest szybkie.",
    rating: 4,
  },
].map((review, i) => ({
  ...review,
  id: `sample-${i}`,
  sample: true,
  userId: null,
  status: "published" as const,
  createdAt: new Date("2026-11-10T12:00:00Z"),
}));

export const defaultSettings = {
  id: 1,
  name: "NEXORA",
  description: "Elektronika, która dobrze pasuje do Twojej codzienności.",
  email: "kontakt@nexora.example",
  freeShipping: 19900,
  shippingOptions: [
    { id: "pickup", price: 999 },
    { id: "courier", price: 1499 },
    { id: "express", price: 2499 },
  ],
  newsletterEnabled: true,
  heroTitle: "Technologia, która robi różnicę.",
  heroText:
    "Odkryj sprzęt zaprojektowany z myślą o Twojej codzienności. Wyjątkowa jakość, nowoczesny design i komfort bez kompromisów.",
  seo: null,
};
