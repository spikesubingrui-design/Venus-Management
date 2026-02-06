import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, (process as any).cwd(), '');
  
  // API Key 从环境变量读取
  const DOUBAO_API_KEY = env.API_KEY || env.DOUBAO_API_KEY || env.VITE_API_KEY || '';
  
  // Supabase 配置
  const SUPABASE_URL = env.SUPABASE_URL || env.VITE_SUPABASE_URL || 'https://oqoqrdcaenwucncqinin.supabase.co';
  const SUPABASE_ANON_KEY = env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9xb3FyZGNhZW53dWNuY3FpbmluIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczNTI2MDAsImV4cCI6MjA4MjkyODYwMH0.NsDQSUD9RrczMhfZJYaU8hSfD0F2IWJZmQeRwTOdXAA';
  
  return {
    plugins: [react({
      jsxRuntime: 'automatic',
      jsxImportSource: 'react'
    })],
    base: '/Venus-Management/',
    esbuild: {
      jsxDev: false
    },
    define: {
      'process.env.API_KEY': JSON.stringify(DOUBAO_API_KEY),
      'process.env.DOUBAO_API_KEY': JSON.stringify(DOUBAO_API_KEY),
      'process.env.SUPABASE_URL': JSON.stringify(SUPABASE_URL),
      'process.env.SUPABASE_ANON_KEY': JSON.stringify(SUPABASE_ANON_KEY),
      'process.env.NODE_ENV': JSON.stringify('production'),
      '__DEV__': 'false',
    },
    build: {
      outDir: 'dist',
      minify: 'esbuild',
      rollupOptions: {
        input: {
          main: './index.html'
        }
      }
    }
  };
});