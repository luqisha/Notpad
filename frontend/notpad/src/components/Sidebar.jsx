export default function Sidebar() {
  return (
    <aside className="w-60 border-r bg-white hidden md:block">
      <div className="p-4">
        <ul className="space-y-2">
          <li className="px-3 py-2 rounded hover:bg-gray-100 cursor-pointer">Notes</li>
        </ul>
      </div>
    </aside>
  );
}