import TopBar from '../components/TopBar';
import Sidebar from '../components/Sidebar';
import NoteArea from '../components/NoteArea';

export default function Dashboard() {
  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <TopBar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto p-4">
          <NoteArea />
        </main>
      </div>
    </div>
  );
}