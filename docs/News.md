# ✨ What's New in AdGuard Buddy ✨

**August 24, 2025**

## 🧭 Query Log: Combined View, Server IPs & Color Highlighting

New improvements to the Query Log make multi-server troubleshooting much easier:

- **Single / Combined view**: choose between a single-server view or a combined view that aggregates logs from all configured servers.
- **Server IP in the table**: each log row now displays the source server IP so you can immediately see which server emitted the request.
- **Per-server Color Chooser**: click the color swatch next to a server and pick a color — rows from that server are subtly highlighted in the table.
- **Persistence**: selected colors are saved into the connections JSON file (`.data/connections.json`) so they survive reloads.
- **Clear colors**: a "Clear colors" button resets all colors.

## ⚡ Performance & UX

- **Batched fetching & concurrency controls**: combined fetches are executed in configurable batches with limited parallelism so the client stays responsive.
- **Per-server / Combined limits & pagination**: controls for per-server limits, combined max, and pagination keep the UI usable with many servers.
- **Stable controls**: the controls bar (view mode, server select, refresh interval) was refactored and memoized so polling only updates the table — dropdowns keep their selection and focus.

## 🧩 Technical details & files

- See `src/app/query-log/page.tsx` (log UI, swatches, persistence) and `src/app/query-log/PageControls.tsx` (memoized controls) for the main changes.

Enjoy the update — tell us if you want default colors or different highlighting per server.

**August 23, 2025**

We're excited to introduce some brand new features to AdGuard Buddy!

## 📊 Combined Statistics! (As in issue #1 wanted)

We've added a new feature that allows you to view combined statistics from all your AdGuard Home instances in one place.

*   **Get the big picture!** 📈 Now you can see the total number of queries, blocked queries, and more from all your servers combined.
*   **Easy to use!** 💻 The combined statistics are displayed in a new section on the statistics page.

## 🚀 A Brand New "What's New" Popup!

We've added a "What's New" popup to keep you informed about the latest changes and improvements to AdGuard Buddy.

*   **Stay up-to-date!** 📰 Now you'll get a notification right in the app whenever we make changes.
*   **Sleek new design!** 🎨 We've designed the popup to be clean, modern, and easy on the eyes. We've also added full dark mode support! 
*   **Powered by Markdown!** 📝 The content of the popup is rendered from a simple Markdown file, so it's easy to read and maintain.