# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
- **Guests:** local and out-of-town visitors (barkada groups, families, school and company "organizers") booking a camping area or the Rock Activities Package at Goatcliff Adventure and Camping, La Trinidad, Benguet. They arrive from Goatcliff's Facebook page, mostly on phones, and pay a down payment by GCash.
- **Super Admin (2, owners):** everything, including prices, activities, staff accounts and analytics. Reads requests at night.
- **Staff Admin (3, front desk):** enters walk-ins and Messenger/phone bookings, checks GCash references, handles cancellations, reschedules and refunds, closes days. Uses a laptop on site and a phone.
- **Field Staff (4 weekday guides + 6 weekend student helpers):** rotate by station (warm-up/gear, via ferrata, Burmese bridge, rappelling); see all of today's groups and mark them Done or Failed to show, on phones.

## Product Purpose
Replace Facebook-message booking and the Google Sheet with an online booking site and an admin back office, so guests can see availability and book themselves, and staff stop double-booking and losing track of payments. Success: a guest books in minutes on a phone; the front desk can find any booking from a GCash reference and keep the daily rock headcount accurate.

## Positioning
A booking system for one specific place: a limestone crag with a daily rock limit (80, viewers included) and fourteen named camping areas (Lower Area LA1–LA4, Upper Area UA3–UA5, Under the Tree UT, Car Camping CA1–CA4). Availability is about days and places, not generic slots.

## Operating Context
- Bookings also arrive through Messenger, phone and walk-ins; staff enter them. No internet on site at times (paper first, entered later).
- Payment: 50% down payment by GCash Send Money; the guest's GCash reference confirms the booking; staff check it later; mismatches are settled on arrival.
- Camping check-in 1:00 PM, check-out 12:00 noon. Tent rental available.
- Closures are announced on Messenger and the Facebook page.
- Capstone project of University of the Cordilleras students; live demo on Wednesday Oct 28, 2026. Frontend runs on demo data (no database connection yet) and must run from GitHub.

## Capabilities and Constraints
- React 19 + Vite + react-router; Supabase backend (free tier). Frontend must work with fake demo data when no Supabase settings exist.
- English only. No delete buttons anywhere (statuses change instead). At least one active Super Admin.
- Discounts (senior, PWD, Atok local, organizer, child viewing) are 20% per person and never stack; down payment is 50% of the discounted price.
- Guests can reschedule or request a refund until Dec 31 of the visit year, at least 2 days before the visit.

## Brand Commitments
- Name: Goatcliff Adventure and Camping. No logo asset on hand.
- Client asked for a "glassmorphism" look earlier; client has "no design preference" per the interview.
- Pine green and sunrise colours were used in previous previews (not a client commitment).

## Evidence on Hand
- Real prices: Rock Activities Package ₱1,500/person (ages 10+), viewing ₱250, camping per-area price per night plus ₱100 per person per night, tents ₱350 (4-person) / ₱250 (2-person) per stay.
- No real photos, testimonials, reviews or ratings: do not invent them. GCash name/number and Facebook page link are placeholders.

## Product Principles
- Days and places first: always show what's free on which day.
- Phone-first for guests and Field Staff; laptop-first for the front desk.
- Nothing is deleted; every risky action says what it affects before it happens.
- Plain, local, friendly English.

## Accessibility & Inclusion
Readable outdoors on budget Android phones in sunlight: strong contrast, large touch targets, light rendering cost.
