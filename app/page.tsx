import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { 
  Home, 
  Shield, 
  Activity, 
  Server, 
  TrendingUp, 
  Bell,
  Cpu,
  Network,
  Lock
} from 'lucide-react';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 dark:from-gray-900 dark:to-gray-800">
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <div className="flex justify-center mb-4">
            <div className="p-4 bg-primary-600 rounded-full">
              <Home className="h-12 w-12 text-white" />
            </div>
          </div>
          <h1 className="text-5xl font-bold text-gray-900 dark:text-white mb-4">
            Welcome to HomeOps
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            Your intelligent home automation platform with financial trading capabilities
          </p>
          <div className="mt-8 flex gap-4 justify-center">
            <Link href="/dashboard">
              <Button size="lg" className="btn btn-primary">
                Go to Dashboard
              </Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="outline">
                Sign In
              </Button>
            </Link>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mt-16">
          <Card className="p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-center mb-4">
              <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                <Shield className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-lg font-semibold ml-3">VPN Protection</h3>
            </div>
            <p className="text-gray-600 dark:text-gray-400">
              Secure all your services with automated VPN routing through Gluetun
            </p>
          </Card>

          <Card className="p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-center mb-4">
              <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
                <Activity className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="text-lg font-semibold ml-3">Health Monitoring</h3>
            </div>
            <p className="text-gray-600 dark:text-gray-400">
              Real-time monitoring of all services with instant alerts
            </p>
          </Card>

          <Card className="p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-center mb-4">
              <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
                <Server className="h-6 w-6 text-purple-600 dark:text-purple-400" />
              </div>
              <h3 className="text-lg font-semibold ml-3">Docker Management</h3>
            </div>
            <p className="text-gray-600 dark:text-gray-400">
              Control and monitor all your Docker containers from one place
            </p>
          </Card>

          <Card className="p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-center mb-4">
              <div className="p-2 bg-yellow-100 dark:bg-yellow-900 rounded-lg">
                <TrendingUp className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
              </div>
              <h3 className="text-lg font-semibold ml-3">Financial Trading</h3>
            </div>
            <p className="text-gray-600 dark:text-gray-400">
              Automated trading strategies with real-time market analysis
            </p>
          </Card>

          <Card className="p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-center mb-4">
              <div className="p-2 bg-red-100 dark:bg-red-900 rounded-lg">
                <Bell className="h-6 w-6 text-red-600 dark:text-red-400" />
              </div>
              <h3 className="text-lg font-semibold ml-3">Smart Alerts</h3>
            </div>
            <p className="text-gray-600 dark:text-gray-400">
              Customizable alerts for system events and market conditions
            </p>
          </Card>

          <Card className="p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-center mb-4">
              <div className="p-2 bg-indigo-100 dark:bg-indigo-900 rounded-lg">
                <Cpu className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
              </div>
              <h3 className="text-lg font-semibold ml-3">AI Assistant</h3>
            </div>
            <p className="text-gray-600 dark:text-gray-400">
              Natural language interface powered by advanced AI models
            </p>
          </Card>
        </div>

        {/* Status Section */}
        <div className="mt-16 bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-xl">
          <h2 className="text-2xl font-bold mb-6 text-center">System Status</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-green-100 dark:bg-green-900 rounded-full mb-2">
                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
              </div>
              <p className="font-semibold">All Systems Operational</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Last checked: Just now</p>
            </div>
            <div className="text-center">
              <Network className="h-8 w-8 mx-auto mb-2 text-blue-600 dark:text-blue-400" />
              <p className="font-semibold">Network: Protected</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">VPN Active</p>
            </div>
            <div className="text-center">
              <Lock className="h-8 w-8 mx-auto mb-2 text-green-600 dark:text-green-400" />
              <p className="font-semibold">Security: Enabled</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">All services secured</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}