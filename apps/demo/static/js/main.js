// Inventory for modularization
// Core (wiederverwendbar) → Kandidat Library:
// - Aggregation laden/manipulieren, Farben anwenden, Part-Liste lesen
// - Kamera framing / viewport helpers
//
// UI glue → bleibt App:
// - DOM refs, Event-Wiring, Modals, Slider, Buttons, Set-List rendering
//
// Experimentell → erstmal App oder internal/:
// - Set-preview warming/caching und card-navigation

import { bootApp } from './events.ts';

bootApp();