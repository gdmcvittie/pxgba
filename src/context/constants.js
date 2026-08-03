export const DEFAULT_16_PALETTE = [
  '#000000', '#1d2b53', '#7e2553', '#008751',
  '#ab5236', '#5f574f', '#c2c3c7', '#fff1e8',
  '#ff004d', '#ffa300', '#ffec27', '#00e436',
  '#29adff', '#83769c', '#ff77a8', '#ffccaa',
  '#000814', '#003566', '#00b4d8', '#caf0f8'
];

export const RAW_DEFAULT_TILES = [
  {
    id: 1,
    name: "Player",
    collisionType: "none",
    data: [
      [null, null, "#ff004d", "#ff004d", "#ff004d", "#ff004d", null, null],
      [null, "#ff004d", "#ff004d", "#ff004d", "#ff004d", "#ff004d", "#ff004d", null],
      [null, "#ff004d", "#fff1e8", "#000000", "#fff1e8", "#000000", "#fff1e8", null],
      [null, "#fff1e8", "#fff1e8", "#fff1e8", "#fff1e8", "#fff1e8", "#fff1e8", null],
      [null, null, "#29adff", "#29adff", "#29adff", "#29adff", null, null],
      [null, "#29adff", "#29adff", "#29adff", "#29adff", "#29adff", "#29adff", null],
      [null, null, "#ffa300", "#ffa300", "#ffa300", "#ffa300", null, null],
      [null, "#5f574f", "#5f574f", null, null, "#5f574f", "#5f574f", null]
    ]
  },
  {
    id: 2,
    name: "NPC",
    collisionType: "none",
    data: [
      [null, null, "#00e436", "#00e436", "#00e436", "#00e436", null, null],
      [null, "#00e436", "#00e436", "#00e436", "#00e436", "#00e436", "#00e436", null],
      [null, "#00e436", "#fff1e8", "#000000", "#fff1e8", "#000000", "#fff1e8", null],
      [null, "#fff1e8", "#fff1e8", "#fff1e8", "#fff1e8", "#fff1e8", "#fff1e8", null],
      [null, null, "#ffa300", "#ffa300", "#ffa300", "#ffa300", null, null],
      [null, "#ffa300", "#ffa300", "#ffa300", "#ffa300", "#ffa300", "#ffa300", null],
      [null, null, "#5f574f", "#5f574f", "#5f574f", "#5f574f", null, null],
      [null, "#83769c", "#83769c", null, null, "#83769c", "#83769c", null]
    ]
  },
  {
    id: 3,
    name: "Platform",
    collisionType: "none",
    data: [
      ["#00e436", "#00e436", "#00e436", "#00e436", "#00e436", "#00e436", "#00e436", "#00e436"],
      ["#00e436", "#00e436", "#00e436", "#00e436", "#00e436", "#00e436", "#00e436", "#00e436"],
      ["#1d2b53", "#1d2b53", "#1d2b53", "#1d2b53", "#1d2b53", "#1d2b53", "#1d2b53", "#1d2b53"],
      ["#5f574f", "#5f574f", "#5f574f", "#5f574f", "#ab5236", "#ab5236", "#5f574f", "#5f574f"],
      ["#5f574f", "#5f574f", "#ab5236", "#ab5236", "#5f574f", "#5f574f", "#5f574f", "#5f574f"],
      ["#1d2b53", "#1d2b53", "#1d2b53", "#1d2b53", "#1d2b53", "#1d2b53", "#1d2b53", "#1d2b53"],
      ["#5f574f", "#ab5236", "#5f574f", "#5f574f", "#5f574f", "#5f574f", "#ab5236", "#5f574f"],
      ["#5f574f", "#5f574f", "#5f574f", "#5f574f", "#5f574f", "#5f574f", "#5f574f", "#5f574f"]
    ]
  },
  {
    id: 4,
    name: "Ladder",
    collisionType: "none",
    data: [
      ["#ab5236", "#5f574f", null, null, null, null, "#ab5236", "#5f574f"],
      ["#ab5236", "#5f574f", "#ab5236", "#ab5236", "#ab5236", "#ab5236", "#ab5236", "#5f574f"],
      ["#ab5236", "#5f574f", "#5f574f", "#5f574f", "#5f574f", "#5f574f", "#ab5236", "#5f574f"],
      ["#ab5236", "#5f574f", null, null, null, null, "#ab5236", "#5f574f"],
      ["#ab5236", "#5f574f", "#ab5236", "#ab5236", "#ab5236", "#ab5236", "#ab5236", "#5f574f"],
      ["#ab5236", "#5f574f", "#5f574f", "#5f574f", "#5f574f", "#5f574f", "#ab5236", "#5f574f"],
      ["#ab5236", "#5f574f", null, null, null, null, "#ab5236", "#5f574f"],
      ["#ab5236", "#5f574f", "#ab5236", "#ab5236", "#ab5236", "#ab5236", "#ab5236", "#5f574f"]
    ]
  },
  {
    id: 5,
    name: "Bonus",
    collisionType: "none",
    data: [
      [null, null, "#000000", "#000000", "#000000", "#000000", null, null],
      [null, "#000000", "#ffec27", "#ffec27", "#ffec27", "#fff1e8", "#000000", null],
      ["#000000", "#ffec27", "#ffec27", "#ffec27", "#fff1e8", "#fff1e8", "#ffa300", "#000000"],
      ["#000000", "#ffec27", "#ffec27", "#fff1e8", "#fff1e8", "#ffa300", "#ffa300", "#000000"],
      ["#000000", "#ffec27", "#fff1e8", "#fff1e8", "#ffa300", "#ffa300", "#ffa300", "#000000"],
      ["#000000", "#fff1e8", "#fff1e8", "#ffa300", "#ffa300", "#ffa300", "#ffa300", "#000000"],
      [null, "#000000", "#ffa300", "#ffa300", "#ffa300", "#ffa300", "#000000", null],
      [null, null, "#000000", "#000000", "#000000", "#000000", null, null]
    ]
  },
  {
    id: 6,
    name: "Spring",
    collisionType: "none",
    data: [
      [null, "#ff004d", "#ff004d", "#ff004d", "#ff004d", "#ff004d", "#ff004d", null],
      [null, "#ff004d", "#ff004d", "#ff004d", "#ff004d", "#ff004d", "#ff004d", null],
      [null, null, "#000000", "#000000", "#000000", "#000000", null, null],
      [null, null, "#c2c3c7", "#c2c3c7", "#c2c3c7", "#83769c", null, null],
      [null, null, "#83769c", "#c2c3c7", "#c2c3c7", "#c2c3c7", null, null],
      [null, null, "#c2c3c7", "#c2c3c7", "#c2c3c7", "#83769c", null, null],
      [null, "#000000", "#000000", "#000000", "#000000", "#000000", "#000000", null],
      ["#000000", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000"]
    ]
  },
  {
    id: 7,
    name: "Hazard",
    collisionType: "none",
    data: [
      [null, null, null, null, null, null, null, null],
      [null, "#fff1e8", null, null, null, "#fff1e8", null, null],
      [null, "#ff004d", "#83769c", null, null, "#ff004d", "#83769c", null],
      ["#fff1e8", "#ff004d", "#83769c", null, "#fff1e8", "#ff004d", "#83769c", null],
      ["#ff004d", "#ff004d", "#83769c", null, "#ff004d", "#ff004d", "#83769c", null],
      ["#ff004d", "#ff004d", "#ff004d", "#83769c", "#ff004d", "#ff004d", "#ff004d", "#83769c"],
      ["#ff004d", "#ff004d", "#ff004d", "#ff004d", "#ff004d", "#ff004d", "#ff004d", "#ff004d"],
      ["#ff004d", "#ff004d", "#ff004d", "#ff004d", "#ff004d", "#ff004d", "#ff004d", "#ff004d"]
    ]
  },
  {
    id: 8,
    name: "Enemy",
    collisionType: "none",
    data: [
      [null, "#83769c", null, null, null, null, "#83769c", null],
      [null, "#ff004d", "#83769c", null, null, "#83769c", "#ff004d", null],
      [null, "#ff004d", "#ff004d", "#ff004d", "#ff004d", "#ff004d", "#ff004d", null],
      [null, "#ff004d", "#fff1e8", "#000000", "#ff004d", "#fff1e8", "#000000", null],
      [null, "#ff004d", "#fff1e8", "#000000", "#ff004d", "#fff1e8", "#000000", null],
      [null, "#ff004d", "#ff004d", "#ff004d", "#ff004d", "#ff004d", "#ff004d", null],
      [null, "#ff004d", "#ff004d", "#ff004d", "#ff004d", "#ff004d", "#ff004d", null],
      [null, "#83769c", null, "#83769c", null, "#83769c", null, "#83769c"]
    ]
  },
  {
    id: 9,
    name: "Destructible",
    collisionType: "none",
    data: [
      ["#ab5236", "#ab5236", "#ab5236", "#ab5236", "#ab5236", "#ab5236", "#ab5236", "#fff1e8"],
      ["#ab5236", "#000000", "#ab5236", "#ab5236", "#ab5236", "#000000", "#ab5236", "#ab5236"],
      ["#ab5236", "#ab5236", "#000000", "#ab5236", "#000000", "#ab5236", "#ab5236", "#ab5236"],
      ["#ab5236", "#ab5236", "#ab5236", "#000000", "#ab5236", "#ab5236", "#ab5236", "#ab5236"],
      ["#ab5236", "#ab5236", "#000000", "#ab5236", "#000000", "#ab5236", "#ab5236", "#ab5236"],
      ["#ab5236", "#000000", "#ab5236", "#ab5236", "#ab5236", "#000000", "#ab5236", "#ab5236"],
      ["#fff1e8", "#ab5236", "#ab5236", "#ab5236", "#ab5236", "#ab5236", "#ab5236", "#5f574f"],
      ["#5f574f", "#5f574f", "#5f574f", "#5f574f", "#5f574f", "#5f574f", "#5f574f", "#5f574f"]
    ]
  },
  {
    id: 10,
    name: "Key",
    collisionType: "none",
    data: [
      [null, null, null, null, null, null, null, null],
      [null, "#000000", "#000000", "#000000", null, null, null, null],
      ["#000000", "#ffec27", null, "#ffec27", "#000000", "#000000", "#000000", null],
      ["#000000", null, null, null, "#ffec27", "#ffec27", "#ffec27", "#000000"],
      ["#000000", "#ffec27", null, "#ffec27", "#000000", "#ffec27", "#000000", "#ffec27"],
      [null, "#000000", "#000000", "#000000", null, "#000000", null, "#000000"],
      [null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null]
    ]
  },
  {
    id: 11,
    name: "Locked Door",
    collisionType: "none",
    data: [
      ["#5f574f", "#ab5236", "#ab5236", "#ab5236", "#ab5236", "#ab5236", "#ab5236", "#5f574f"],
      ["#5f574f", "#ab5236", "#ab5236", "#ab5236", "#ab5236", "#ab5236", "#ab5236", "#5f574f"],
      ["#5f574f", "#ab5236", "#ab5236", "#000000", "#000000", "#ab5236", "#ab5236", "#5f574f"],
      ["#5f574f", "#ab5236", "#000000", "#ffec27", "#ffec27", "#000000", "#ab5236", "#5f574f"],
      ["#5f574f", "#ab5236", "#000000", "#ffec27", "#000000", "#000000", "#ab5236", "#5f574f"],
      ["#5f574f", "#ab5236", "#ab5236", "#000000", "#000000", "#ab5236", "#ab5236", "#5f574f"],
      ["#5f574f", "#ab5236", "#ab5236", "#ab5236", "#ab5236", "#ab5236", "#ab5236", "#5f574f"],
      ["#5f574f", "#5f574f", "#5f574f", "#5f574f", "#5f574f", "#5f574f", "#5f574f", "#5f574f"]
    ]
  },
  {
    id: 12,
    name: "Power-up",
    collisionType: "none",
    data: [
      [null, null, null, "#ffec27", "#fff1e8", null, null, null],
      [null, null, "#ffec27", "#ffec27", "#fff1e8", "#ffec27", null, null],
      [null, "#ffec27", "#ffec27", "#ffec27", "#fff1e8", "#ffec27", "#ffec27", null],
      ["#ffec27", "#ffec27", "#ffec27", "#ffec27", "#fff1e8", "#ffec27", "#ffec27", "#ffec27"],
      [null, "#ffa300", "#ffec27", "#ffec27", "#ffec27", "#ffec27", "#ffa300", null],
      [null, null, "#ffa300", "#ffec27", "#ffec27", "#ffa300", null, null],
      [null, null, "#ffa300", "#ffec27", "#ffec27", "#ffa300", null, null],
      [null, "#ffa300", "#ffa300", null, null, "#ffa300", "#ffa300", null]
    ]
  },
  {
    id: 13,
    name: "Sign",
    collisionType: "none",
    data: [
      [null, "#ab5236", "#ab5236", "#ab5236", "#ab5236", "#ab5236", "#ab5236", null],
      ["#ab5236", "#fff1e8", "#ab5236", "#ab5236", "#ab5236", "#ab5236", "#ab5236", "#ab5236"],
      ["#ab5236", "#ab5236", "#000000", "#ab5236", "#000000", "#ab5236", "#ab5236", "#ab5236"],
      ["#ab5236", "#ab5236", "#ab5236", "#ab5236", "#ab5236", "#ab5236", "#ab5236", "#ab5236"],
      [null, "#ab5236", "#ab5236", "#ab5236", "#ab5236", "#ab5236", "#ab5236", null],
      [null, null, "#5f574f", "#5f574f", null, null, null, null],
      [null, null, "#5f574f", "#5f574f", null, null, null, null],
      [null, null, "#5f574f", "#5f574f", null, null, null, null]
    ]
  },
  {
    id: 14,
    name: "Conveyor Belt",
    collisionType: "none",
    data: [
      ["#5f574f", "#5f574f", "#5f574f", "#5f574f", "#5f574f", "#5f574f", "#5f574f", "#5f574f"],
      ["#5f574f", "#c2c3c7", "#c2c3c7", "#c2c3c7", "#5f574f", "#c2c3c7", "#c2c3c7", "#5f574f"],
      ["#5f574f", "#c2c3c7", "#c2c3c7", "#5f574f", "#c2c3c7", "#c2c3c7", "#5f574f", "#c2c3c7"],
      ["#5f574f", "#5f574f", "#c2c3c7", "#c2c3c7", "#c2c3c7", "#5f574f", "#c2c3c7", "#5f574f"],
      ["#5f574f", "#c2c3c7", "#5f574f", "#c2c3c7", "#c2c3c7", "#c2c3c7", "#5f574f", "#c2c3c7"],
      ["#5f574f", "#c2c3c7", "#c2c3c7", "#5f574f", "#c2c3c7", "#c2c3c7", "#c2c3c7", "#5f574f"],
      ["#5f574f", "#5f574f", "#5f574f", "#5f574f", "#5f574f", "#5f574f", "#5f574f", "#5f574f"],
      ["#5f574f", "#5f574f", "#5f574f", "#5f574f", "#5f574f", "#5f574f", "#5f574f", "#5f574f"]
    ]
  },
  {
    id: 15,
    name: "Brick Block",
    collisionType: "none",
    data: [
      ["#ff004d", "#ff004d", "#ff004d", "#ff004d", "#7e2553", "#c2c3c7", "#ff004d", "#ff004d"],
      ["#ff004d", "#ff004d", "#ff004d", "#ff004d", "#7e2553", "#c2c3c7", "#ff004d", "#ff004d"],
      ["#c2c3c7", "#c2c3c7", "#c2c3c7", "#c2c3c7", "#c2c3c7", "#c2c3c7", "#c2c3c7", "#c2c3c7"],
      ["#c2c3c7", "#ff004d", "#ff004d", "#ff004d", "#ff004d", "#ff004d", "#ff004d", "#7e2553"],
      ["#c2c3c7", "#ff004d", "#ff004d", "#ff004d", "#ff004d", "#ff004d", "#ff004d", "#7e2553"],
      ["#c2c3c7", "#c2c3c7", "#c2c3c7", "#c2c3c7", "#c2c3c7", "#c2c3c7", "#c2c3c7", "#c2c3c7"],
      ["#ff004d", "#ff004d", "#ff004d", "#ff004d", "#7e2553", "#c2c3c7", "#ff004d", "#ff004d"],
      ["#ff004d", "#ff004d", "#ff004d", "#ff004d", "#7e2553", "#c2c3c7", "#ff004d", "#ff004d"]
    ]
  },
  {
    id: 16,
    name: "Sand Block",
    collisionType: "none",
    data: [
      ["#ffec27", "#ffec27", "#ffec27", "#ffec27", "#ffa300", "#ffa300", "#ffec27", "#ffec27"],
      ["#ffec27", "#ffec27", "#ffec27", "#ffa300", "#fff1e8", "#fff1e8", "#ffa300", "#ffec27"],
      ["#ffec27", "#ffec27", "#ffa300", "#fff1e8", "#ffec27", "#ffec27", "#fff1e8", "#ffa300"],
      ["#ffec27", "#ffa300", "#fff1e8", "#ffec27", "#ffec27", "#ffec27", "#ffec27", "#fff1e8"],
      ["#ffa300", "#fff1e8", "#ffec27", "#ffec27", "#ffec27", "#ffec27", "#ffec27", "#ffec27"],
      ["#fff1e8", "#ffec27", "#ffec27", "#ffec27", "#ffec27", "#ffa300", "#ffa300", "#ffec27"],
      ["#ffec27", "#ffec27", "#ffec27", "#ffec27", "#ffa300", "#fff1e8", "#fff1e8", "#ffa300"],
      ["#ffec27", "#ffec27", "#ffec27", "#ffa300", "#fff1e8", "#ffec27", "#ffec27", "#fff1e8"]
    ]
  },
  {
    id: 17,
    name: "Mud Block",
    collisionType: "none",
    data: [
      ["#5f574f", "#5f574f", "#5f574f", "#5f574f", "#5f574f", "#5f574f", "#5f574f", "#5f574f"],
      ["#5f574f", "#5f574f", "#5f574f", "#5f574f", "#5f574f", "#5f574f", "#008751", "#5f574f"],
      ["#5f574f", "#5f574f", "#ab5236", "#ab5236", "#5f574f", "#5f574f", "#008751", "#008751"],
      ["#5f574f", "#5f574f", "#ab5236", "#ab5236", "#5f574f", "#5f574f", "#5f574f", "#5f574f"],
      ["#5f574f", "#5f574f", "#5f574f", "#5f574f", "#5f574f", "#5f574f", "#5f574f", "#5f574f"],
      ["#008751", "#5f574f", "#5f574f", "#5f574f", "#5f574f", "#5f574f", "#5f574f", "#5f574f"],
      ["#008751", "#008751", "#5f574f", "#5f574f", "#5f574f", "#5f574f", "#ab5236", "#5f574f"],
      ["#5f574f", "#5f574f", "#5f574f", "#5f574f", "#5f574f", "#5f574f", "#5f574f", "#5f574f"]
    ]
  },
  {
    id: 18,
    name: "Stone Wall",
    collisionType: "none",
    data: [
      ["#83769c", "#83769c", "#83769c", "#83769c", "#5f574f", "#1d2b53", "#83769c", "#83769c"],
      ["#83769c", "#c2c3c7", "#c2c3c7", "#83769c", "#5f574f", "#1d2b53", "#83769c", "#c2c3c7"],
      ["#1d2b53", "#1d2b53", "#1d2b53", "#1d2b53", "#1d2b53", "#1d2b53", "#1d2b53", "#1d2b53"],
      ["#1d2b53", "#83769c", "#83769c", "#83769c", "#83769c", "#83769c", "#83769c", "#5f574f"],
      ["#1d2b53", "#83769c", "#c2c3c7", "#c2c3c7", "#c2c3c7", "#83769c", "#83769c", "#5f574f"],
      ["#1d2b53", "#1d2b53", "#1d2b53", "#1d2b53", "#1d2b53", "#1d2b53", "#1d2b53", "#1d2b53"],
      ["#83769c", "#83769c", "#83769c", "#83769c", "#5f574f", "#1d2b53", "#83769c", "#83769c"],
      ["#83769c", "#c2c3c7", "#c2c3c7", "#83769c", "#5f574f", "#1d2b53", "#83769c", "#c2c3c7"]
    ]
  },
  {
    id: 19,
    name: "Water Block",
    collisionType: "none",
    data: [
      [null, null, "#29adff", "#29adff", null, null, "#29adff", "#29adff"],
      [null, "#29adff", "#29adff", "#29adff", "#29adff", null, "#29adff", "#29adff"],
      ["#29adff", "#29adff", "#29adff", "#29adff", "#29adff", "#29adff", "#29adff", "#29adff"],
      ["#29adff", "#29adff", "#29adff", "#29adff", "#29adff", "#29adff", "#29adff", "#29adff"],
      ["#29adff", "#1d2b53", "#1d2b53", "#29adff", "#29adff", "#1d2b53", "#1d2b53", "#29adff"],
      ["#29adff", "#29adff", "#29adff", "#29adff", "#29adff", "#29adff", "#29adff", "#29adff"],
      ["#29adff", "#29adff", "#29adff", "#29adff", "#29adff", "#29adff", "#29adff", "#29adff"],
      ["#29adff", "#29adff", "#29adff", "#29adff", "#29adff", "#29adff", "#29adff", "#29adff"]
    ]
  },
  {
    id: 20,
    name: "Wood Block",
    collisionType: "none",
    data: [
      ["#1d2b53", "#1d2b53", "#1d2b53", "#1d2b53", "#1d2b53", "#1d2b53", "#1d2b53", "#1d2b53"],
      ["#1d2b53", "#fff1e8", "#ab5236", "#ab5236", "#ab5236", "#ab5236", "#5f574f", "#1d2b53"],
      ["#1d2b53", "#ab5236", "#fff1e8", "#ab5236", "#ab5236", "#5f574f", "#ab5236", "#1d2b53"],
      ["#1d2b53", "#ab5236", "#ab5236", "#fff1e8", "#5f574f", "#ab5236", "#ab5236", "#1d2b53"],
      ["#1d2b53", "#ab5236", "#ab5236", "#5f574f", "#fff1e8", "#ab5236", "#ab5236", "#1d2b53"],
      ["#1d2b53", "#ab5236", "#5f574f", "#ab5236", "#ab5236", "#fff1e8", "#ab5236", "#1d2b53"],
      ["#1d2b53", "#5f574f", "#ab5236", "#ab5236", "#ab5236", "#ab5236", "#fff1e8", "#1d2b53"],
      ["#1d2b53", "#1d2b53", "#1d2b53", "#1d2b53", "#1d2b53", "#1d2b53", "#1d2b53", "#1d2b53"]
    ]
  },
  {
    id: 21,
    name: "Heart",
    collisionType: "none",
    data: [
      [null, null, null, null, null, null, null, null],
      [null, "#000000", "#000000", null, null, "#000000", "#000000", null],
      ["#000000", "#ff004d", "#fff1e8", "#000000", "#000000", "#ff004d", "#ff004d", "#000000"],
      ["#000000", "#ff004d", "#ff004d", "#ff004d", "#ff004d", "#ff004d", "#ff004d", "#000000"],
      [null, "#000000", "#ff004d", "#ff004d", "#ff004d", "#ff004d", "#000000", null],
      [null, null, "#000000", "#ff004d", "#ff004d", "#000000", null, null],
      [null, null, null, "#000000", "#000000", null, null, null],
      [null, null, null, null, null, null, null, null]
    ]
  },
  {
    id: 22,
    name: "Pointer",
    collisionType: "none",
    data: [
      ["#000000", "#000000", null, null, null, null, null, null],
      ["#000000", "#fff1e8", "#000000", null, null, null, null, null],
      ["#000000", "#fff1e8", "#fff1e8", "#000000", null, null, null, null],
      ["#000000", "#fff1e8", "#fff1e8", "#fff1e8", "#000000", null, null, null],
      ["#000000", "#fff1e8", "#fff1e8", "#fff1e8", "#fff1e8", "#000000", null, null],
      ["#000000", "#fff1e8", "#000000", "#000000", "#000000", null, null, null],
      ["#000000", "#000000", null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null]
    ]
  },
  {
    id: 23,
    name: "Hover Pointer",
    collisionType: "none",
    data: [
      [null, null, null, "#000000", "#000000", null, null, null],
      [null, null, "#000000", "#fff1e8", "#fff1e8", "#000000", null, null],
      [null, null, "#000000", "#fff1e8", "#fff1e8", "#000000", null, null],
      [null, "#000000", "#000000", "#fff1e8", "#fff1e8", "#000000", "#000000", null],
      ["#000000", "#fff1e8", "#000000", "#fff1e8", "#fff1e8", "#000000", "#fff1e8", "#000000"],
      ["#000000", "#fff1e8", "#fff1e8", "#fff1e8", "#fff1e8", "#fff1e8", "#fff1e8", "#000000"],
      [null, "#000000", "#000000", "#000000", "#000000", "#000000", "#000000", null],
      [null, null, null, null, null, null, null, null]
    ]
  },
  {
    id: 24,
    name: "SHMUP Player Ship",
    collisionType: "none",
    data: [
      [null, null, null, null, null, null, null, null],
      [null, null, null, "#ff004d", "#ff004d", null, null, null],
      [null, null, "#ff004d", "#ff004d", "#c2c3c7", "#fff1e8", null, null],
      ["#ffa300", "#ff004d", "#ff004d", "#fff1e8", "#29adff", "#29adff", "#fff1e8", null],
      ["#ffa300", "#ff004d", "#ff004d", "#fff1e8", "#29adff", "#29adff", "#fff1e8", null],
      [null, null, "#ff004d", "#ff004d", "#c2c3c7", "#fff1e8", null, null],
      [null, null, null, "#ff004d", "#ff004d", null, null, null],
      [null, null, null, null, null, null, null, null]
    ]
  },
  {
    id: 25,
    name: "SHMUP Enemy Ship",
    collisionType: "none",
    data: [
      [null, null, null, null, null, null, null, null],
      [null, null, null, "#29adff", "#29adff", null, null, null],
      [null, null, "#29adff", "#fff1e8", "#fff1e8", "#29adff", null, null],
      [null, "#83769c", "#83769c", "#83769c", "#83769c", "#83769c", "#83769c", null],
      ["#83769c", "#ff004d", "#83769c", "#ff004d", "#83769c", "#ff004d", "#83769c", "#83769c"],
      [null, "#83769c", "#83769c", "#83769c", "#83769c", "#83769c", "#83769c", null],
      [null, null, null, "#ffec27", "#ffec27", null, null, null],
      [null, null, null, null, null, null, null, null]
    ]
  },
  {
    id: 26,
    name: "SHMUP Laser",
    collisionType: "none",
    data: [
      [null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null],
      ["#ffa300", "#ffec27", "#fff1e8", "#fff1e8", "#fff1e8", "#fff1e8", "#ffec27", "#ffa300"],
      ["#ffa300", "#ffec27", "#fff1e8", "#fff1e8", "#fff1e8", "#fff1e8", "#ffec27", "#ffa300"],
      [null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null]
    ]
  },
  {
    id: 27,
    name: "Racing Car",
    collisionType: "none",
    data: [
      [null, null, null, null, null, null, null, null],
      [null, "#000000", null, null, null, "#000000", null, null],
      ["#ff004d", "#ff004d", "#ff004d", "#ff004d", "#ff004d", "#ff004d", "#ffec27", null],
      ["#ffa300", "#ff004d", "#29adff", "#29adff", "#ff004d", "#ff004d", "#ff004d", null],
      ["#ffa300", "#ff004d", "#29adff", "#29adff", "#ff004d", "#ff004d", "#ff004d", null],
      ["#ff004d", "#ff004d", "#ff004d", "#ff004d", "#ff004d", "#ff004d", "#ffec27", null],
      [null, "#000000", null, null, null, "#000000", null, null],
      [null, null, null, null, null, null, null, null]
    ]
  },
  {
    id: 28,
    name: "Racing Obstacle",
    collisionType: "none",
    data: [
      [null, null, null, null, null, null, null, null],
      [null, null, null, "#ffa300", "#ffa300", null, null, null],
      [null, null, null, "#fff1e8", "#fff1e8", null, null, null],
      [null, null, "#ffa300", "#ffa300", "#ffa300", "#ffa300", null, null],
      [null, null, "#fff1e8", "#fff1e8", "#fff1e8", "#fff1e8", null, null],
      [null, "#ffa300", "#ffa300", "#ffa300", "#ffa300", "#ffa300", "#ffa300", null],
      ["#ffa300", "#ffa300", "#ffa300", "#ffa300", "#ffa300", "#ffa300", "#ffa300", "#ffa300"],
      [null, null, null, null, null, null, null, null]
    ]
  },
  {
    id: 29,
    name: "Racing Finish Line",
    collisionType: "none",
    data: [
      ["#000000", "#000000", "#fff1e8", "#fff1e8", "#000000", "#000000", "#fff1e8", "#fff1e8"],
      ["#000000", "#000000", "#fff1e8", "#fff1e8", "#000000", "#000000", "#fff1e8", "#fff1e8"],
      ["#fff1e8", "#fff1e8", "#000000", "#000000", "#fff1e8", "#fff1e8", "#000000", "#000000"],
      ["#fff1e8", "#fff1e8", "#000000", "#000000", "#fff1e8", "#fff1e8", "#000000", "#000000"],
      ["#000000", "#000000", "#fff1e8", "#fff1e8", "#000000", "#000000", "#fff1e8", "#fff1e8"],
      ["#000000", "#000000", "#fff1e8", "#fff1e8", "#000000", "#000000", "#fff1e8", "#fff1e8"],
      ["#fff1e8", "#fff1e8", "#000000", "#000000", "#fff1e8", "#fff1e8", "#000000", "#000000"],
      ["#fff1e8", "#fff1e8", "#000000", "#000000", "#fff1e8", "#fff1e8", "#000000", "#000000"]
    ]
  },
  {
    id: 30,
    name: "Road",
    collisionType: "none",
    data: [
      ["#c2c3c7", "#c2c3c7", "#c2c3c7", "#c2c3c7", "#c2c3c7", "#c2c3c7", "#c2c3c7", "#c2c3c7"],
      ["#c2c3c7", "#c2c3c7", "#c2c3c7", "#c2c3c7", "#c2c3c7", "#c2c3c7", "#c2c3c7", "#c2c3c7"],
      ["#c2c3c7", "#c2c3c7", "#c2c3c7", "#5f574f", "#c2c3c7", "#c2c3c7", "#c2c3c7", "#c2c3c7"],
      ["#c2c3c7", "#c2c3c7", "#c2c3c7", "#c2c3c7", "#c2c3c7", "#5f574f", "#c2c3c7", "#c2c3c7"],
      ["#c2c3c7", "#c2c3c7", "#5f574f", "#c2c3c7", "#c2c3c7", "#c2c3c7", "#c2c3c7", "#c2c3c7"],
      ["#c2c3c7", "#c2c3c7", "#c2c3c7", "#c2c3c7", "#c2c3c7", "#c2c3c7", "#5f574f", "#c2c3c7"],
      ["#c2c3c7", "#c2c3c7", "#c2c3c7", "#c2c3c7", "#c2c3c7", "#c2c3c7", "#c2c3c7", "#c2c3c7"],
      ["#c2c3c7", "#c2c3c7", "#c2c3c7", "#c2c3c7", "#c2c3c7", "#c2c3c7", "#c2c3c7", "#c2c3c7"]
    ]
  },
  {
    id: 31,
    name: "Turret",
    collisionType: "none",
    data: [
      [null, null, null, null, null, null, null, null],
      [null, null, null, "#c2c3c7", "#c2c3c7", null, null, null],
      [null, null, "#c2c3c7", "#c2c3c7", null, null, null, null],
      [null, "#5f574f", "#5f574f", "#5f574f", "#5f574f", "#5f574f", "#5f574f", null],
      [null, "#5f574f", null, "#c2c3c7", "#c2c3c7", null, "#5f574f", null],
      [null, "#5f574f", "#5f574f", "#5f574f", "#5f574f", "#5f574f", "#5f574f", null],
      [null, null, "#ab5236", "#ab5236", "#ab5236", "#ab5236", null, null],
      [null, null, null, null, null, null, null, null]
    ]
  },
  {
    id: 32,
    name: "Spawner",
    collisionType: "none",
    data: [
      [null, null, null, null, null, null, null, null],
      [null, null, null, "#83769c", "#83769c", null, null, null],
      [null, null, "#83769c", "#c2c3c7", "#c2c3c7", "#83769c", null, null],
      [null, "#83769c", "#c2c3c7", "#c2c3c7", "#c2c3c7", "#c2c3c7", "#83769c", null],
      [null, null, "#83769c", "#c2c3c7", "#c2c3c7", "#83769c", null, null],
      [null, null, null, "#83769c", "#83769c", null, null, null],
      [null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null]
    ]
  },
  {
    id: 33,
    name: "Companion Dog",
    collisionType: "none",
    data: [
      [null, "#5f574f", null, null, null, null, "#5f574f", null],
      [null, "#ab5236", "#ab5236", "#ab5236", "#ab5236", "#ab5236", "#ab5236", null],
      [null, "#ab5236", "#000000", "#ffccaa", "#ffccaa", "#000000", "#ab5236", null],
      [null, "#ab5236", "#ffccaa", "#ffccaa", "#ffccaa", "#ffccaa", "#ab5236", null],
      [null, null, "#ab5236", "#ab5236", "#ab5236", "#ab5236", null, null],
      [null, "#ab5236", "#ab5236", "#ab5236", "#ab5236", "#ab5236", "#ab5236", null],
      [null, "#ab5236", "#ab5236", "#ff004d", "#ab5236", "#ab5236", "#ab5236", null],
      ["#5f574f", "#5f574f", null, null, null, "#5f574f", "#5f574f", null]
    ]
  },
  {
    id: 34,
    name: "Pressure Plate",
    collisionType: "none",
    data: [
      [null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null],
      [null, "#c2c3c7", "#c2c3c7", "#c2c3c7", "#c2c3c7", "#c2c3c7", "#c2c3c7", null],
      ["#5f574f", "#c2c3c7", "#c2c3c7", "#c2c3c7", "#c2c3c7", "#c2c3c7", "#c2c3c7", "#5f574f"],
      ["#5f574f", "#5f574f", "#5f574f", "#5f574f", "#5f574f", "#5f574f", "#5f574f", "#5f574f"]
    ]
  },
  {
    id: 35,
    name: "Push Target",
    collisionType: "none",
    data: [
      [null, null, null, null, null, null, null, null],
      [null, "#00e436", "#00e436", "#00e436", "#00e436", "#00e436", "#00e436", null],
      [null, "#00e436", null, null, null, null, "#00e436", null],
      [null, "#00e436", null, "#000000", "#000000", null, "#00e436", null],
      [null, "#00e436", null, "#000000", "#000000", null, "#00e436", null],
      [null, "#00e436", null, null, null, null, "#00e436", null],
      [null, "#00e436", "#00e436", "#00e436", "#00e436", "#00e436", "#00e436", null],
      [null, null, null, null, null, null, null, null]
    ]
  },
  {
    id: 36,
    name: "Teleporter",
    collisionType: "none",
    data: [
      [null, null, "#29adff", "#29adff", "#29adff", "#29adff", null, null],
      [null, "#29adff", "#fff1e8", "#fff1e8", "#fff1e8", "#fff1e8", "#29adff", null],
      ["#29adff", "#fff1e8", "#29adff", "#29adff", "#29adff", "#29adff", "#fff1e8", "#29adff"],
      ["#29adff", "#fff1e8", "#29adff", "#000000", "#000000", "#29adff", "#fff1e8", "#29adff"],
      ["#29adff", "#fff1e8", "#29adff", "#000000", "#000000", "#29adff", "#fff1e8", "#29adff"],
      ["#29adff", "#fff1e8", "#29adff", "#29adff", "#29adff", "#29adff", "#fff1e8", "#29adff"],
      [null, "#29adff", "#fff1e8", "#fff1e8", "#fff1e8", "#fff1e8", "#29adff", null],
      [null, null, "#29adff", "#29adff", "#29adff", "#29adff", null, null]
    ]
  },
  {
    id: 37,
    name: "Crumbling Platform",
    collisionType: "none",
    data: [
      [null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null],
      [null, "#ab5236", "#ab5236", "#ab5236", "#ab5236", "#ab5236", "#ab5236", null],
      ["#ab5236", "#5f574f", "#ab5236", "#ab5236", "#ab5236", "#ab5236", "#5f574f", "#ab5236"],
      ["#ab5236", "#ab5236", "#ab5236", "#5f574f", "#5f574f", "#ab5236", "#ab5236", "#ab5236"],
      ["#5f574f", "#ab5236", "#5f574f", "#ab5236", "#ab5236", "#5f574f", "#ab5236", "#5f574f"]
    ]
  },
  {
    id: 38,
    name: "Ice Block",
    collisionType: "none",
    data: [
      ["#29adff", "#29adff", "#29adff", "#29adff", "#29adff", "#29adff", "#29adff", "#29adff"],
      ["#29adff", "#fff1e8", "#fff1e8", "#29adff", "#29adff", "#fff1e8", "#fff1e8", "#29adff"],
      ["#29adff", "#fff1e8", "#29adff", "#29adff", "#29adff", "#29adff", "#fff1e8", "#29adff"],
      ["#29adff", "#29adff", "#29adff", "#fff1e8", "#fff1e8", "#29adff", "#29adff", "#29adff"],
      ["#29adff", "#29adff", "#29adff", "#fff1e8", "#fff1e8", "#29adff", "#29adff", "#29adff"],
      ["#29adff", "#fff1e8", "#29adff", "#29adff", "#29adff", "#29adff", "#fff1e8", "#29adff"],
      ["#29adff", "#fff1e8", "#fff1e8", "#29adff", "#29adff", "#fff1e8", "#fff1e8", "#29adff"],
      ["#29adff", "#29adff", "#29adff", "#29adff", "#29adff", "#29adff", "#29adff", "#29adff"]
    ]
  },
  {
    id: 39,
    name: "Chest",
    collisionType: "none",
    data: [
      [null, null, null, null, null, null, null, null],
      [null, "#ab5236", "#ab5236", "#ab5236", "#ab5236", "#ab5236", "#ab5236", null],
      [null, "#ab5236", "#ffa300", "#ffa300", "#ffa300", "#ffa300", "#ab5236", null],
      [null, "#ab5236", "#ffa300", "#ffec27", "#ffec27", "#ffa300", "#ab5236", null],
      [null, "#ab5236", "#ab5236", "#ab5236", "#ab5236", "#ab5236", "#ab5236", null],
      [null, "#ab5236", "#ab5236", "#ffec27", "#ffec27", "#ab5236", "#ab5236", null],
      [null, "#ab5236", "#ab5236", "#ab5236", "#ab5236", "#ab5236", "#ab5236", null],
      [null, null, null, null, null, null, null, null]
    ]
  },
  {
    id: 40,
    name: "Torch",
    collisionType: "none",
    data: [
      [null, null, null, "#ffec27", "#ffec27", null, null, null],
      [null, null, "#ffa300", "#ffec27", "#ffec27", "#ffa300", null, null],
      [null, null, "#ff004d", "#ffa300", "#ffa300", "#ff004d", null, null],
      [null, null, null, "#ff004d", "#ff004d", null, null, null],
      [null, null, null, "#5f574f", "#5f574f", null, null, null],
      [null, null, null, "#5f574f", "#5f574f", null, null, null],
      [null, null, null, "#5f574f", "#5f574f", null, null, null],
      [null, null, "#5f574f", "#5f574f", "#5f574f", "#5f574f", null, null]
    ]
  },
  {
    id: 42,
    name: "Save Point",
    collisionType: "none",
    data: [
      [null, null, null, "#29adff", "#29adff", null, null, null],
      [null, null, "#29adff", "#fff1e8", "#fff1e8", "#29adff", null, null],
      [null, "#29adff", "#fff1e8", "#fff1e8", "#fff1e8", "#fff1e8", "#29adff", null],
      ["#29adff", "#fff1e8", "#fff1e8", "#fff1e8", "#fff1e8", "#fff1e8", "#fff1e8", "#29adff"],
      ["#29adff", "#fff1e8", "#fff1e8", "#fff1e8", "#fff1e8", "#fff1e8", "#fff1e8", "#29adff"],
      [null, "#29adff", "#fff1e8", "#fff1e8", "#fff1e8", "#fff1e8", "#29adff", null],
      [null, null, "#29adff", "#fff1e8", "#fff1e8", "#29adff", null, null],
      [null, null, null, "#29adff", "#29adff", null, null, null]
    ]
  },
  {
    id: 43,
    name: "XP Orb",
    collisionType: "none",
    data: [
      [null, null, null, null, null, null, null, null],
      [null, null, "#ffec27", "#ffec27", "#ffec27", "#ffec27", null, null],
      [null, "#ffec27", "#fff1e8", "#fff1e8", "#fff1e8", "#fff1e8", "#ffec27", null],
      [null, "#ffec27", "#fff1e8", "#ffec27", "#ffec27", "#fff1e8", "#ffec27", null],
      [null, "#ffec27", "#fff1e8", "#ffec27", "#ffec27", "#fff1e8", "#ffec27", null],
      [null, "#ffec27", "#fff1e8", "#fff1e8", "#fff1e8", "#fff1e8", "#ffec27", null],
      [null, null, "#ffec27", "#ffec27", "#ffec27", "#ffec27", null, null],
      [null, null, null, null, null, null, null, null]
    ]
  },
  {
    id: 44,
    name: "Shield",
    collisionType: "none",
    data: [
      [null, null, "#c2c3c7", "#c2c3c7", "#c2c3c7", "#c2c3c7", null, null],
      [null, "#c2c3c7", "#29adff", "#29adff", "#29adff", "#29adff", "#c2c3c7", null],
      ["#c2c3c7", "#29adff", "#fff1e8", "#fff1e8", "#fff1e8", "#fff1e8", "#29adff", "#c2c3c7"],
      ["#c2c3c7", "#29adff", "#fff1e8", "#29adff", "#29adff", "#fff1e8", "#29adff", "#c2c3c7"],
      ["#c2c3c7", "#29adff", "#fff1e8", "#29adff", "#29adff", "#fff1e8", "#29adff", "#c2c3c7"],
      ["#c2c3c7", "#29adff", "#fff1e8", "#fff1e8", "#fff1e8", "#fff1e8", "#29adff", "#c2c3c7"],
      [null, "#c2c3c7", "#29adff", "#29adff", "#29adff", "#29adff", "#c2c3c7", null],
      [null, null, "#c2c3c7", "#c2c3c7", "#c2c3c7", "#c2c3c7", null, null]
    ]
  },
  {
    id: 45,
    name: "Ammo Pickup",
    collisionType: "none",
    data: [
      [null, null, null, null, null, null, null, null],
      [null, null, "#ffa300", "#ffa300", "#ffa300", "#ffa300", null, null],
      [null, "#ffa300", "#ffec27", "#ffec27", "#ffec27", "#ffec27", "#ffa300", null],
      [null, "#ffa300", "#ffec27", "#000000", "#000000", "#ffec27", "#ffa300", null],
      [null, "#ffa300", "#ffec27", "#000000", "#000000", "#ffec27", "#ffa300", null],
      [null, "#ffa300", "#ffec27", "#ffec27", "#ffec27", "#ffec27", "#ffa300", null],
      [null, null, "#ffa300", "#ffa300", "#ffa300", "#ffa300", null, null],
      [null, null, null, null, null, null, null, null]
    ]
  },
  {
    id: 46,
    name: "Grenade",
    collisionType: "none",
    data: [
      [null, null, null, "#5f574f", "#5f574f", null, null, null],
      [null, null, "#5f574f", "#5f574f", "#5f574f", "#5f574f", null, null],
      [null, null, "#008751", "#008751", "#008751", "#008751", null, null],
      [null, "#008751", "#008751", "#008751", "#008751", "#008751", "#008751", null],
      [null, "#008751", "#008751", "#008751", "#008751", "#008751", "#008751", null],
      [null, "#008751", "#008751", "#008751", "#008751", "#008751", "#008751", null],
      [null, null, "#008751", "#008751", "#008751", "#008751", null, null],
      [null, null, null, null, null, null, null, null]
    ]
  },
  {
    id: 48,
    name: "Wall Jump Surface",
    collisionType: "none",
    data: [
      ["#5f574f", "#c2c3c7", "#5f574f", "#5f574f", "#5f574f", "#5f574f", "#5f574f", "#5f574f"],
      ["#5f574f", "#c2c3c7", "#5f574f", "#5f574f", "#5f574f", "#5f574f", "#5f574f", "#5f574f"],
      ["#5f574f", "#c2c3c7", "#5f574f", "#5f574f", "#5f574f", "#5f574f", "#5f574f", "#5f574f"],
      ["#5f574f", "#c2c3c7", "#5f574f", "#5f574f", "#5f574f", "#5f574f", "#5f574f", "#5f574f"],
      ["#5f574f", "#c2c3c7", "#5f574f", "#5f574f", "#5f574f", "#5f574f", "#5f574f", "#5f574f"],
      ["#5f574f", "#c2c3c7", "#5f574f", "#5f574f", "#5f574f", "#5f574f", "#5f574f", "#5f574f"],
      ["#5f574f", "#c2c3c7", "#5f574f", "#5f574f", "#5f574f", "#5f574f", "#5f574f", "#5f574f"],
      ["#5f574f", "#c2c3c7", "#5f574f", "#5f574f", "#5f574f", "#5f574f", "#5f574f", "#5f574f"]
    ]
  },
  {
    id: 49,
    name: "One-Way Wall",
    collisionType: "none",
    data: [
      ["#ab5236", "#ab5236", "#ab5236", "#ab5236", "#ab5236", "#ab5236", "#ab5236", "#ab5236"],
      ["#ab5236", "#5f574f", "#5f574f", "#ab5236", "#ab5236", "#5f574f", "#5f574f", "#ab5236"],
      ["#ab5236", "#5f574f", "#5f574f", "#ab5236", "#ab5236", "#5f574f", "#5f574f", "#ab5236"],
      ["#ab5236", "#ab5236", "#ab5236", "#ab5236", "#ab5236", "#ab5236", "#ab5236", "#ab5236"],
      ["#ab5236", "#ab5236", "#ab5236", "#ab5236", "#ab5236", "#ab5236", "#ab5236", "#ab5236"],
      ["#ab5236", "#5f574f", "#5f574f", "#ab5236", "#ab5236", "#5f574f", "#5f574f", "#ab5236"],
      ["#ab5236", "#5f574f", "#5f574f", "#ab5236", "#ab5236", "#5f574f", "#5f574f", "#ab5236"],
      ["#ab5236", "#ab5236", "#ab5236", "#ab5236", "#ab5236", "#ab5236", "#ab5236", "#ab5236"]
    ]
  },
  {
    id: 50,
    name: "Magnet",
    collisionType: "none",
    data: [
      [null, "#ff004d", "#ff004d", null, null, "#ff004d", "#ff004d", null],
      ["#ff004d", "#ff004d", null, null, null, null, "#ff004d", "#ff004d"],
      ["#ff004d", null, null, null, null, null, null, "#ff004d"],
      ["#ff004d", null, null, null, null, null, null, "#ff004d"],
      ["#ff004d", null, null, null, null, null, null, "#ff004d"],
      ["#ff004d", null, null, null, null, null, null, "#ff004d"],
      ["#c2c3c7", null, null, null, null, null, null, "#c2c3c7"],
      ["#c2c3c7", "#c2c3c7", null, null, null, null, "#c2c3c7", "#c2c3c7"]
    ]
  },
  {
    id: 51,
    name: "Gravity Flip Zone",
    collisionType: "none",
    data: [
      [null, null, null, "#7e2553", "#7e2553", null, null, null],
      [null, null, "#7e2553", "#ff77a8", "#ff77a8", "#7e2553", null, null],
      [null, "#7e2553", "#ff77a8", "#fff1e8", "#fff1e8", "#ff77a8", "#7e2553", null],
      ["#7e2553", "#ff77a8", "#fff1e8", "#fff1e8", "#fff1e8", "#fff1e8", "#ff77a8", "#7e2553"],
      ["#7e2553", "#ff77a8", "#fff1e8", "#fff1e8", "#fff1e8", "#fff1e8", "#ff77a8", "#7e2553"],
      [null, "#7e2553", "#ff77a8", "#fff1e8", "#fff1e8", "#ff77a8", "#7e2553", null],
      [null, null, "#7e2553", "#ff77a8", "#ff77a8", "#7e2553", null, null],
      [null, null, null, "#7e2553", "#7e2553", null, null, null]
    ]
  },
  {
    id: 56,
    name: "Boost Pad",
    collisionType: "none",
    data: [
      [null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null],
      [null, "#ff004d", "#ff004d", "#ff004d", "#ff004d", "#ff004d", "#ff004d", null],
      [null, "#ff004d", "#ffec27", "#ffec27", "#ffec27", "#ffec27", "#ff004d", null],
      [null, "#ff004d", "#ffec27", "#ff004d", "#ff004d", "#ffec27", "#ff004d", null],
      [null, "#ff004d", "#ff004d", "#ff004d", "#ff004d", "#ff004d", "#ff004d", null],
      [null, null, null, null, null, null, null, null]
    ]
  },
  {
    id: 57,
    name: "Checkpoint Gate",
    collisionType: "none",
    data: [
      [null, "#ffec27", "#ffec27", null, null, "#ffec27", "#ffec27", null],
      [null, "#ffec27", "#ffec27", null, null, "#ffec27", "#ffec27", null],
      [null, "#ffec27", "#ffec27", null, null, "#ffec27", "#ffec27", null],
      [null, "#ffec27", "#ffec27", "#ffec27", "#ffec27", "#ffec27", "#ffec27", null],
      [null, "#ffec27", "#ffec27", "#ffec27", "#ffec27", "#ffec27", "#ffec27", null],
      [null, "#ffec27", "#ffec27", null, null, "#ffec27", "#ffec27", null],
      [null, "#ffec27", "#ffec27", null, null, "#ffec27", "#ffec27", null],
      [null, "#ffec27", "#ffec27", null, null, "#ffec27", "#ffec27", null]
    ]
  },
  {
    id: 58,
    name: "Checkpoint",
    collisionType: "none",
    data: [
      [null, null, null, "#c2c3c7", "#c2c3c7", null, null, null],
      [null, null, null, "#c2c3c7", "#c2c3c7", null, null, null],
      [null, "#ff004d", "#ff004d", "#c2c3c7", "#c2c3c7", null, null, null],
      [null, "#ff004d", "#ff004d", "#c2c3c7", "#c2c3c7", null, null, null],
      [null, "#ff004d", "#ff004d", "#c2c3c7", "#c2c3c7", null, null, null],
      [null, null, null, "#c2c3c7", "#c2c3c7", null, null, null],
      [null, null, null, "#c2c3c7", "#c2c3c7", null, null, null],
      ["#5f574f", "#5f574f", "#5f574f", "#c2c3c7", "#c2c3c7", "#5f574f", "#5f574f", "#5f574f"]
    ]
  },
  {
    id: 59,
    name: "Grass Block",
    collisionType: "none",
    data: [
      ["#00e436", "#00e436", "#008751", "#00e436", "#00e436", "#00e436", "#008751", "#00e436"],
      ["#00e436", "#008751", "#008751", "#00e436", "#00e436", "#00e436", "#008751", "#008751"],
      ["#00e436", "#00e436", "#00e436", "#00e436", "#00e436", "#00e436", "#00e436", "#00e436"],
      ["#008751", "#00e436", "#00e436", "#008751", "#00e436", "#00e436", "#00e436", "#00e436"],
      ["#008751", "#008751", "#00e436", "#008751", "#008751", "#00e436", "#00e436", "#00e436"],
      ["#00e436", "#00e436", "#00e436", "#00e436", "#00e436", "#00e436", "#008751", "#00e436"],
      ["#00e436", "#00e436", "#00e436", "#00e436", "#00e436", "#00e436", "#008751", "#008751"],
      ["#00e436", "#00e436", "#00e436", "#00e436", "#00e436", "#00e436", "#00e436", "#00e436"]
    ]
  },
  {
    id: 60,
    name: "Cave Wall",
    collisionType: "none",
    data: [
      ["#1d2b53", "#1d2b53", "#5f574f", "#1d2b53", "#1d2b53", "#5f574f", "#1d2b53", "#1d2b53"],
      ["#1d2b53", "#5f574f", "#5f574f", "#1d2b53", "#5f574f", "#5f574f", "#5f574f", "#1d2b53"],
      ["#5f574f", "#5f574f", "#1d2b53", "#5f574f", "#5f574f", "#1d2b53", "#5f574f", "#5f574f"],
      ["#1d2b53", "#5f574f", "#5f574f", "#5f574f", "#1d2b53", "#5f574f", "#5f574f", "#1d2b53"],
      ["#5f574f", "#1d2b53", "#5f574f", "#5f574f", "#5f574f", "#5f574f", "#1d2b53", "#5f574f"],
      ["#1d2b53", "#5f574f", "#1d2b53", "#5f574f", "#5f574f", "#1d2b53", "#5f574f", "#5f574f"],
      ["#5f574f", "#5f574f", "#5f574f", "#1d2b53", "#1d2b53", "#5f574f", "#5f574f", "#1d2b53"],
      ["#1d2b53", "#1d2b53", "#5f574f", "#5f574f", "#1d2b53", "#1d2b53", "#5f574f", "#1d2b53"]
    ]
  },
  {
    id: 61,
    name: "Cave Platform",
    collisionType: "none",
    data: [
      ["#7e2553", "#7e2553", "#7e2553", "#7e2553", "#7e2553", "#7e2553", "#7e2553", "#7e2553"],
      ["#7e2553", "#ab5236", "#ab5236", "#7e2553", "#7e2553", "#ab5236", "#ab5236", "#7e2553"],
      ["#7e2553", "#ab5236", "#7e2553", "#7e2553", "#ab5236", "#7e2553", "#7e2553", "#7e2553"],
      ["#7e2553", "#7e2553", "#7e2553", "#ab5236", "#7e2553", "#7e2553", "#ab5236", "#7e2553"],
      ["#ab5236", "#7e2553", "#ab5236", "#7e2553", "#7e2553", "#ab5236", "#7e2553", "#ab5236"],
      ["#7e2553", "#ab5236", "#7e2553", "#ab5236", "#ab5236", "#7e2553", "#ab5236", "#7e2553"],
      ["#7e2553", "#7e2553", "#ab5236", "#7e2553", "#7e2553", "#ab5236", "#7e2553", "#7e2553"],
      ["#ab5236", "#ab5236", "#7e2553", "#ab5236", "#ab5236", "#7e2553", "#ab5236", "#ab5236"]
    ]
  },
  {
    id: 62,
    name: "Cave Crystal",
    collisionType: "none",
    data: [
      [null, null, null, "#29adff", "#29adff", null, null, null],
      [null, null, "#29adff", "#fff1e8", "#29adff", "#29adff", null, null],
      [null, "#29adff", "#29adff", "#fff1e8", "#fff1e8", "#29adff", "#29adff", null],
      ["#29adff", "#29adff", "#fff1e8", "#fff1e8", "#29adff", "#29adff", "#29adff", "#29adff"],
      ["#29adff", "#29adff", "#fff1e8", "#29adff", "#29adff", "#fff1e8", "#29adff", "#29adff"],
      [null, "#29adff", "#29adff", "#29adff", "#29adff", "#29adff", "#29adff", null],
      [null, null, "#29adff", "#29adff", "#29adff", "#29adff", null, null],
      [null, null, null, "#29adff", "#29adff", null, null, null]
    ]
  },
  {
    id: 63,
    name: "Cave Mushroom",
    collisionType: "none",
    data: [
      [null, null, null, "#ff77a8", "#ff77a8", null, null, null],
      [null, null, "#ff77a8", "#fff1e8", "#ff77a8", "#ff77a8", null, null],
      [null, "#ff77a8", "#ff77a8", "#fff1e8", "#fff1e8", "#ff77a8", "#ff77a8", null],
      ["#ff77a8", "#ff77a8", "#fff1e8", "#fff1e8", "#ff77a8", "#ff77a8", "#ff77a8", "#ff77a8"],
      [null, null, "#c2c3c7", "#c2c3c7", "#c2c3c7", "#c2c3c7", null, null],
      [null, null, "#c2c3c7", "#c2c3c7", "#c2c3c7", "#c2c3c7", null, null],
      [null, null, "#c2c3c7", null, null, "#c2c3c7", null, null],
      [null, null, "#c2c3c7", null, null, "#c2c3c7", null, null]
    ]
  },
  {
    id: 64,
    name: "Cave Vine",
    collisionType: "none",
    data: [
      [null, null, "#00e436", "#00e436", "#00e436", "#00e436", null, null],
      [null, "#00e436", "#008751", "#00e436", "#00e436", "#008751", "#00e436", null],
      ["#00e436", "#00e436", "#008751", "#00e436", "#00e436", "#008751", "#00e436", "#00e436"],
      [null, "#00e436", "#00e436", "#008751", "#008751", "#00e436", "#00e436", null],
      [null, null, "#00e436", "#00e436", "#00e436", "#00e436", null, null],
      [null, "#00e436", "#008751", "#00e436", "#00e436", "#008751", "#00e436", null],
      ["#00e436", "#00e436", "#008751", "#00e436", "#00e436", "#008751", "#00e436", "#00e436"],
      [null, "#00e436", "#00e436", "#008751", "#008751", "#00e436", "#00e436", null]
    ]
  },
  {
    id: 65,
    name: "Cave Stalactite",
    collisionType: "none",
    data: [
      ["#c2c3c7", "#c2c3c7", "#c2c3c7", "#c2c3c7", "#c2c3c7", "#c2c3c7", "#c2c3c7", "#c2c3c7"],
      [null, "#c2c3c7", "#c2c3c7", "#c2c3c7", "#c2c3c7", "#c2c3c7", "#c2c3c7", null],
      [null, null, "#c2c3c7", "#c2c3c7", "#c2c3c7", "#c2c3c7", null, null],
      [null, null, null, "#c2c3c7", "#c2c3c7", null, null, null],
      [null, null, null, "#c2c3c7", "#c2c3c7", null, null, null],
      [null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null]
    ]
  },
  {
    id: 66,
    name: "Cave Pillar",
    collisionType: "none",
    data: [
      [null, null, "#5f574f", "#5f574f", "#5f574f", "#5f574f", null, null],
      [null, "#5f574f", "#83769c", "#83769c", "#83769c", "#83769c", "#5f574f", null],
      [null, "#5f574f", "#83769c", "#83769c", "#83769c", "#83769c", "#5f574f", null],
      [null, "#5f574f", "#83769c", "#83769c", "#83769c", "#83769c", "#5f574f", null],
      [null, "#5f574f", "#83769c", "#83769c", "#83769c", "#83769c", "#5f574f", null],
      [null, "#5f574f", "#83769c", "#83769c", "#83769c", "#83769c", "#5f574f", null],
      [null, "#5f574f", "#83769c", "#83769c", "#83769c", "#83769c", "#5f574f", null],
      [null, null, "#5f574f", "#5f574f", "#5f574f", "#5f574f", null, null]
    ]
  },
  {
    id: 67,
    name: "Cave Background",
    collisionType: "none",
    data: [
      ["#000000", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000"],
      ["#000000", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000"],
      ["#000000", "#000000", "#000000", "#5f574f", "#000000", "#000000", "#000000", "#000000"],
      ["#000000", "#000000", "#000000", "#000000", "#000000", "#5f574f", "#000000", "#000000"],
      ["#000000", "#000000", "#5f574f", "#000000", "#000000", "#000000", "#000000", "#000000"],
      ["#000000", "#000000", "#000000", "#000000", "#000000", "#000000", "#5f574f", "#000000"],
      ["#000000", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000"],
      ["#000000", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000"]
    ]
  },
  {
    id: 70,
    name: "Sonic Ring",
    collisionType: "none",
    data: [
      [null, null, "#ffec27", "#ffec27", "#ffec27", "#ffec27", null, null],
      [null, "#ffec27", "#fff1e8", "#fff1e8", "#ffec27", "#ffa300", "#ffec27", null],
      ["#ffec27", "#fff1e8", "#ffec27", null, null, "#ffec27", "#ffa300", "#ffec27"],
      ["#ffec27", "#fff1e8", null, null, null, null, "#ffa300", "#ffec27"],
      ["#ffec27", "#ffec27", null, null, null, null, "#ffa300", "#ffec27"],
      ["#ffec27", "#ffa300", "#ffec27", null, null, "#ffec27", "#ffa300", "#ffec27"],
      [null, "#ffec27", "#ffa300", "#ffa300", "#ffa300", "#ffa300", "#ffec27", null],
      [null, null, "#ffec27", "#ffec27", "#ffec27", "#ffec27", null, null]
    ]
  },
  {
    id: 71,
    name: "Sonic Spring",
    collisionType: "top",
    data: [
      [null, "#f80000", "#f8f800", "#f8f800", "#f8f800", "#f8f800", "#f80000", null],
      [null, "#f80000", "#f8f800", "#f80000", "#f80000", "#f8f800", "#f80000", null],
      [null, "#f80000", "#f80000", "#f80000", "#f80000", "#f80000", "#f80000", null],
      [null, null, "#c0c0c0", "#c0c0c0", "#c0c0c0", "#c0c0c0", null, null],
      [null, null, "#404040", "#c0c0c0", "#c0c0c0", "#404040", null, null],
      [null, null, "#c0c0c0", "#c0c0c0", "#c0c0c0", "#c0c0c0", null, null],
      [null, "#404040", "#404040", "#404040", "#404040", "#404040", "#404040", null],
      ["#000000", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000"]
    ]
  },
  {
    id: 72,
    name: "Sonic Dash Pad",
    collisionType: "none",
    data: [
      [null, null, null, null, null, null, null, null],
      [null, null, "#f80000", null, null, "#f80000", null, null],
      [null, "#f80000", "#f8f800", "#f80000", "#f80000", "#f8f800", "#f80000", null],
      ["#f80000", "#f8f800", "#f8f800", "#f8f800", "#f8f800", "#f8f800", "#f8f800", "#f80000"],
      ["#f80000", "#f8f800", "#f8f800", "#f8f800", "#f8f800", "#f8f800", "#f8f800", "#f80000"],
      [null, "#f80000", "#f8f800", "#f80000", "#f80000", "#f8f800", "#f80000", null],
      [null, null, "#f80000", null, null, "#f80000", null, null],
      ["#000000", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000"]
    ]
  },
  {
    id: 73,
    name: "Sonic Grass Top",
    collisionType: "solid",
    data: [
      ["#38f838", "#38f838", "#38f838", "#38f838", "#38f838", "#38f838", "#38f838", "#38f838"],
      ["#00c000", "#00c000", "#00c000", "#00c000", "#00c000", "#00c000", "#00c000", "#00c000"],
      ["#006800", "#00c000", "#006800", "#006800", "#00c000", "#006800", "#006800", "#00c000"],
      ["#006800", "#502000", "#006800", "#006800", "#502000", "#006800", "#006800", "#502000"],
      ["#502000", "#a04000", "#a04000", "#502000", "#f89020", "#f89020", "#502000", "#a04000"],
      ["#502000", "#a04000", "#a04000", "#502000", "#f89020", "#f89020", "#502000", "#a04000"],
      ["#502000", "#a04000", "#a04000", "#502000", "#f89020", "#f89020", "#502000", "#a04000"],
      ["#502000", "#502000", "#502000", "#502000", "#502000", "#502000", "#502000", "#502000"]
    ]
  },
  {
    id: 74,
    name: "Sonic Slope Up 45",
    collisionType: "slope-up",
    data: [
      [null, null, null, null, null, null, "#38f838", "#38f838"],
      [null, null, null, null, null, "#38f838", "#00c000", "#006800"],
      [null, null, null, null, "#38f838", "#00c000", "#006800", "#502000"],
      [null, null, null, "#38f838", "#00c000", "#006800", "#502000", "#a04000"],
      [null, null, "#38f838", "#00c000", "#006800", "#502000", "#a04000", "#f89020"],
      [null, "#38f838", "#00c000", "#006800", "#502000", "#a04000", "#f89020", "#f89020"],
      ["#38f838", "#00c000", "#006800", "#502000", "#a04000", "#f89020", "#f89020", "#502000"],
      ["#00c000", "#006800", "#502000", "#a04000", "#f89020", "#f89020", "#502000", "#a04000"]
    ]
  },
  {
    id: 75,
    name: "Sonic Slope Down 45",
    collisionType: "slope-down",
    data: [
      ["#38f838", "#38f838", null, null, null, null, null, null],
      ["#006800", "#00c000", "#38f838", null, null, null, null, null],
      ["#502000", "#006800", "#00c000", "#38f838", null, null, null, null],
      ["#a04000", "#502000", "#006800", "#00c000", "#38f838", null, null, null],
      ["#f89020", "#a04000", "#502000", "#006800", "#00c000", "#38f838", null, null],
      ["#f89020", "#f89020", "#a04000", "#502000", "#006800", "#00c000", "#38f838", null],
      ["#502000", "#f89020", "#f89020", "#a04000", "#502000", "#006800", "#00c000", "#38f838"],
      ["#a04000", "#502000", "#f89020", "#f89020", "#a04000", "#502000", "#006800", "#00c000"]
    ]
  },
  {
    id: 76,
    name: "Sonic Gentle Slope Up",
    collisionType: "slope-up",
    data: [
      [null, null, null, null, "#38f838", "#38f838", "#38f838", "#38f838"],
      [null, null, "#38f838", "#38f838", "#00c000", "#00c000", "#00c000", "#00c000"],
      ["#38f838", "#38f838", "#00c000", "#00c000", "#006800", "#006800", "#006800", "#006800"],
      ["#00c000", "#00c000", "#006800", "#006800", "#502000", "#502000", "#502000", "#502000"],
      ["#006800", "#006800", "#502000", "#502000", "#a04000", "#a04000", "#a04000", "#a04000"],
      ["#502000", "#502000", "#a04000", "#a04000", "#f89020", "#f89020", "#f89020", "#f89020"],
      ["#a04000", "#a04000", "#f89020", "#f89020", "#502000", "#502000", "#502000", "#502000"],
      ["#f89020", "#f89020", "#502000", "#502000", "#a04000", "#a04000", "#a04000", "#a04000"]
    ]
  },
  {
    id: 77,
    name: "Sonic Gentle Slope Down",
    collisionType: "slope-down",
    data: [
      ["#38f838", "#38f838", "#38f838", "#38f838", null, null, null, null],
      ["#00c000", "#00c000", "#00c000", "#00c000", "#38f838", "#38f838", null, null],
      ["#006800", "#006800", "#006800", "#006800", "#00c000", "#00c000", "#38f838", "#38f838"],
      ["#502000", "#502000", "#502000", "#502000", "#006800", "#006800", "#00c000", "#00c000"],
      ["#a04000", "#a04000", "#a04000", "#a04000", "#502000", "#502000", "#006800", "#006800"],
      ["#f89020", "#f89020", "#f89020", "#f89020", "#a04000", "#a04000", "#502000", "#502000"],
      ["#502000", "#502000", "#502000", "#502000", "#f89020", "#f89020", "#a04000", "#a04000"],
      ["#a04000", "#a04000", "#a04000", "#a04000", "#502000", "#502000", "#f89020", "#f89020"]
    ]
  },
  {
    id: 78,
    name: "Sonic Checkered Soil",
    collisionType: "solid",
    data: [
      ["#502000", "#502000", "#502000", "#502000", "#502000", "#502000", "#502000", "#502000"],
      ["#502000", "#a04000", "#a04000", "#502000", "#f89020", "#f89020", "#502000", "#a04000"],
      ["#502000", "#a04000", "#a04000", "#502000", "#f89020", "#f89020", "#502000", "#a04000"],
      ["#502000", "#502000", "#502000", "#502000", "#502000", "#502000", "#502000", "#502000"],
      ["#502000", "#f89020", "#f89020", "#502000", "#a04000", "#a04000", "#502000", "#f89020"],
      ["#502000", "#f89020", "#f89020", "#502000", "#a04000", "#a04000", "#502000", "#f89020"],
      ["#502000", "#f89020", "#f89020", "#502000", "#a04000", "#a04000", "#502000", "#f89020"],
      ["#502000", "#502000", "#502000", "#502000", "#502000", "#502000", "#502000", "#502000"]
    ]
  },
  {
    id: 79,
    name: "Sonic Loop Arch TL",
    collisionType: "solid",
    data: [
      ["#502000", "#502000", "#502000", "#502000", "#502000", "#502000", "#502000", "#502000"],
      ["#502000", "#a04000", "#a04000", "#502000", "#f89020", "#502000", "#502000", "#502000"],
      ["#502000", "#a04000", "#502000", "#38f838", "#38f838", "#38f838", "#38f838", "#38f838"],
      ["#502000", "#38f838", "#38f838", "#00c000", "#00c000", "#00c000", "#00c000", "#00c000"],
      ["#38f838", "#00c000", "#00c000", "#006800", "#006800", "#006800", "#006800", "#006800"],
      ["#00c000", "#006800", "#006800", "#502000", "#502000", "#502000", "#502000", "#502000"],
      ["#006800", "#502000", "#502000", "#a04000", "#a04000", "#502000", "#a04000", "#a04000"],
      ["#502000", "#a04000", "#a04000", "#a04000", "#a04000", "#502000", "#a04000", "#a04000"]
    ]
  },
  {
    id: 80,
    name: "Sonic Loop Wall L",
    collisionType: "solid",
    data: [
      ["#502000", "#502000", "#502000", "#502000", "#502000", "#006800", "#00c000", "#38f838"],
      ["#502000", "#502000", "#502000", "#502000", "#006800", "#00c000", "#38f838", "#502000"],
      ["#502000", "#502000", "#502000", "#006800", "#00c000", "#38f838", "#502000", "#a04000"],
      ["#502000", "#502000", "#006800", "#00c000", "#38f838", "#502000", "#a04000", "#f89020"],
      ["#502000", "#006800", "#00c000", "#38f838", "#502000", "#a04000", "#f89020", "#502000"],
      ["#006800", "#00c000", "#38f838", "#502000", "#a04000", "#f89020", "#502000", "#a04000"],
      ["#00c000", "#38f838", "#502000", "#a04000", "#f89020", "#502000", "#a04000", "#a04000"],
      ["#38f838", "#502000", "#a04000", "#f89020", "#502000", "#a04000", "#a04000", "#502000"]
    ]
  },
  {
    id: 81,
    name: "Sonic Loop Wall R",
    collisionType: "solid",
    data: [
      ["#38f838", "#00c000", "#006800", "#502000", "#502000", "#502000", "#502000", "#502000"],
      ["#502000", "#38f838", "#00c000", "#006800", "#502000", "#502000", "#502000", "#502000"],
      ["#a04000", "#502000", "#38f838", "#00c000", "#006800", "#502000", "#502000", "#502000"],
      ["#f89020", "#a04000", "#502000", "#38f838", "#00c000", "#006800", "#502000", "#502000"],
      ["#502000", "#f89020", "#a04000", "#502000", "#38f838", "#00c000", "#006800", "#502000"],
      ["#a04000", "#502000", "#f89020", "#a04000", "#502000", "#38f838", "#00c000", "#006800"],
      ["#a04000", "#a04000", "#502000", "#f89020", "#a04000", "#502000", "#38f838", "#00c000"],
      ["#502000", "#a04000", "#a04000", "#502000", "#f89020", "#a04000", "#502000", "#38f838"]
    ]
  },
  {
    id: 82,
    name: "Sonic Loop Base",
    collisionType: "solid",
    data: [
      ["#502000", "#502000", "#502000", "#502000", "#502000", "#502000", "#502000", "#502000"],
      ["#502000", "#a04000", "#a04000", "#502000", "#f89020", "#f89020", "#502000", "#a04000"],
      ["#502000", "#502000", "#502000", "#502000", "#502000", "#502000", "#502000", "#502000"],
      ["#006800", "#006800", "#006800", "#006800", "#006800", "#006800", "#006800", "#006800"],
      ["#00c000", "#00c000", "#00c000", "#00c000", "#00c000", "#00c000", "#00c000", "#00c000"],
      ["#38f838", "#38f838", "#38f838", "#38f838", "#38f838", "#38f838", "#38f838", "#38f838"],
      ["#502000", "#502000", "#502000", "#502000", "#502000", "#502000", "#502000", "#502000"],
      ["#502000", "#a04000", "#a04000", "#502000", "#f89020", "#f89020", "#502000", "#a04000"]
    ]
  },
  {
    id: 84,
    name: "Sonic Loop Arch TR",
    collisionType: "solid",
    data: [
      ["#502000", "#502000", "#502000", "#502000", "#502000", "#502000", "#502000", "#502000"],
      ["#502000", "#502000", "#502000", "#502000", "#502000", "#a04000", "#a04000", "#502000"],
      ["#38f838", "#38f838", "#38f838", "#38f838", "#38f838", "#502000", "#a04000", "#502000"],
      ["#00c000", "#00c000", "#00c000", "#00c000", "#00c000", "#38f838", "#38f838", "#502000"],
      ["#006800", "#006800", "#006800", "#006800", "#006800", "#00c000", "#00c000", "#38f838"],
      ["#502000", "#502000", "#502000", "#502000", "#502000", "#006800", "#006800", "#00c000"],
      ["#a04000", "#a04000", "#502000", "#a04000", "#a04000", "#502000", "#502000", "#006800"],
      ["#a04000", "#a04000", "#502000", "#a04000", "#a04000", "#a04000", "#a04000", "#502000"]
    ]
  },
  {
    id: 83,
    name: "Sonic Palm Tree",
    collisionType: "none",
    data: [
      [null, null, "#00c000", "#38f838", "#38f838", "#00c000", null, null],
      [null, "#38f838", "#00c000", "#38f838", "#38f838", "#00c000", "#38f838", null],
      ["#38f838", "#00c000", null, "#f8c020", "#a04000", null, "#00c000", "#38f838"],
      [null, null, null, "#a04000", "#f8c020", null, null, null],
      [null, null, null, "#f8c020", "#a04000", null, null, null],
      [null, null, null, "#a04000", "#f8c020", null, null, null],
      [null, null, null, "#f8c020", "#a04000", null, null, null],
      [null, null, null, "#a04000", "#f8c020", null, null, null]
    ]
  },
  {
    id: 85,
    name: "Sonic Log Bridge",
    collisionType: "solid",
    data: [
      [null, null, null, null, null, null, null, null],
      ["#ab5236", "#ab5236", "#ab5236", "#ab5236", "#ab5236", "#ab5236", "#ab5236", "#ab5236"],
      ["#ffa300", "#5f574f", "#ffa300", "#ffa300", "#ffa300", "#5f574f", "#ffa300", "#ffa300"],
      ["#ab5236", "#5f574f", "#ab5236", "#ab5236", "#ab5236", "#5f574f", "#ab5236", "#ab5236"],
      ["#ab5236", "#ab5236", "#ab5236", "#ab5236", "#ab5236", "#ab5236", "#ab5236", "#ab5236"],
      ["#ffa300", "#5f574f", "#ffa300", "#ffa300", "#ffa300", "#5f574f", "#ffa300", "#ffa300"],
      ["#ab5236", "#5f574f", "#ab5236", "#ab5236", "#ab5236", "#5f574f", "#ab5236", "#ab5236"],
      [null, null, null, null, null, null, null, null]
    ]
  },
  {
    id: 86,
    name: "Sonic Monitor",
    collisionType: "solid",
    data: [
      ["#c2c3c7", "#c2c3c7", "#c2c3c7", "#c2c3c7", "#c2c3c7", "#c2c3c7", "#c2c3c7", "#c2c3c7"],
      ["#c2c3c7", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000", "#c2c3c7"],
      ["#c2c3c7", "#000000", "#29adff", "#29adff", "#29adff", "#29adff", "#000000", "#c2c3c7"],
      ["#c2c3c7", "#000000", "#29adff", "#fff1e8", "#29adff", "#29adff", "#000000", "#c2c3c7"],
      ["#c2c3c7", "#000000", "#29adff", "#29adff", "#29adff", "#29adff", "#000000", "#c2c3c7"],
      ["#c2c3c7", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000", "#c2c3c7"],
      ["#c2c3c7", "#c2c3c7", "#c2c3c7", "#c2c3c7", "#c2c3c7", "#c2c3c7", "#c2c3c7", "#c2c3c7"],
      [null, null, "#5f574f", "#5f574f", "#5f574f", "#5f574f", null, null]
    ]
  },
  {
    id: 87,
    name: "Sonic Flower",
    collisionType: "none",
    data: [
      [null, null, "#ff004d", "#ff004d", "#ff004d", "#ff004d", null, null],
      [null, "#ff004d", "#ffec27", "#ffec27", "#ffec27", "#ffec27", "#ff004d", null],
      ["#ff004d", "#ffec27", "#ffa300", "#ffa300", "#ffa300", "#ffa300", "#ffec27", "#ff004d"],
      ["#ff004d", "#ffec27", "#ffa300", "#ffa300", "#ffa300", "#ffa300", "#ffec27", "#ff004d"],
      [null, "#ff004d", "#ffec27", "#ffec27", "#ffec27", "#ffec27", "#ff004d", null],
      [null, null, "#008751", "#00e436", "#00e436", "#008751", null, null],
      [null, null, null, "#008751", "#008751", null, null, null],
      [null, null, null, "#008751", "#008751", null, null, null]
    ]
  }
];

export const BUTANO_COLLISION_ENUMS = {
  'none': 'NONE',
  'solid': 'SOLID',
  'top': 'TOP',
  'bottom': 'BOTTOM',
  'left': 'LEFT',
  'right': 'RIGHT',
  'ladder': 'LADDER',
  'slope-up': 'SLOPE_UP',
  'slope-down': 'SLOPE_DOWN'
};
