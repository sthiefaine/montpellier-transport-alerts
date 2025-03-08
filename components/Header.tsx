"use client"
import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AlertTriangle, Home, Menu, X } from 'lucide-react';

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
  };

  const isActive = (path: string) => {
    return pathname === path;
  };

  return (
    <nav className="bg-white shadow-sm">
      <div className="container mx-auto px-4">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link 
              href="/" 
              className="flex items-center font-bold text-lg text-blue-600"
            >
              <AlertTriangle className="w-6 h-6 mr-2" />
              Alertes TAM
            </Link>
          </div>

          
          <div className="hidden md:flex items-center space-x-4">
            <Link 
              href="/" 
              className={`flex items-center px-3 py-2 rounded-md ${
                isActive('/') 
                  ? 'bg-blue-100 text-blue-600' 
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <Home className="w-5 h-5 mr-1" />
              Accueil
            </Link>
            <Link 
              href="/alerts" 
              className={`flex items-center px-3 py-2 rounded-md ${
                isActive('/alerts') 
                  ? 'bg-blue-100 text-blue-600' 
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <AlertTriangle className="w-5 h-5 mr-1" />
              Alertes
            </Link>
          </div>

          
          <div className="md:hidden flex items-center">
            <button
              onClick={toggleMobileMenu}
              className="inline-flex items-center justify-center p-2 rounded-md text-gray-700 hover:text-blue-500 hover:bg-gray-100 focus:outline-none"
            >
              {mobileMenuOpen ? (
                <X className="w-6 h-6" />
              ) : (
                <Menu className="w-6 h-6" />
              )}
            </button>
          </div>
        </div>
      </div>

      
      {mobileMenuOpen && (
        <div className="md:hidden">
          <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
            <Link
              href="/"
              className={`flex items-center px-3 py-2 rounded-md ${
                isActive('/') 
                  ? 'bg-blue-100 text-blue-600' 
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
              onClick={closeMobileMenu}
            >
              <Home className="w-5 h-5 mr-1" />
              Accueil
            </Link>
            <Link
              href="/alerts"
              className={`flex items-center px-3 py-2 rounded-md ${
                isActive('/alerts') 
                  ? 'bg-blue-100 text-blue-600' 
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
              onClick={closeMobileMenu}
            >
              <AlertTriangle className="w-5 h-5 mr-1" />
              Alertes
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}