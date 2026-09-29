import type {Metadata} from 'next';
import './globals.css';
import OfflineSupport from '@/components/OfflineSupport';
export const metadata:Metadata={title:'上島町 統合防災WebGIS',description:'上島町の公的な防災・地理情報を一つの地図で確認する参考システム'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="ja"><body>{children}<OfflineSupport/></body></html>;}
