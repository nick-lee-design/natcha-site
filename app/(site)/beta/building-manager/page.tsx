import type { Metadata } from 'next';
import BuildingManager from '@/components/beta/BuildingManager';
import Header from '@/components/Header';
import '@/styles/beta.css';

export const metadata: Metadata = { title: 'Building manager · Beta · TALO Engine' };

export default function BuildingManagerPage() {
  return (
    <div className="beta beta-app">
      <Header solid />
      <BuildingManager />
    </div>
  );
}
