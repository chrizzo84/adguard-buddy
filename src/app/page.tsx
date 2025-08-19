"use client";
import NavMenu from "./components/NavMenu";

export default function Home() {
  return (
    <div className="max-w-lg mx-auto p-8">
      <NavMenu />
      <h1 className="text-2xl font-bold mb-6 text-center">AdGuard Buddy</h1>
      <p className="text-center text-gray-600 mb-8">Welcome! Use the menu to manage settings or view the dashboard.</p>
    </div>
  );
}
