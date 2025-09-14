"use client";

import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { useState } from "react";

export default function Dashboard() {
  const [selectedTab, setSelectedTab] = useState("overview");

  // Fetch data
  const messages = useQuery(api.messages.getAllMessages, { limit: 10 });
  const messageStats = useQuery(api.messages.getStats);
  const customerStats = useQuery(api.customers.getStats);
  const recentCustomers = useQuery(api.customers.getRecentCustomers, {
    limit: 5,
  });
  const systemLogs = useQuery(api.systemLogs.getRecentErrors, {
    limit: 5,
    hours: 24,
  });

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  const truncateText = (text: string, maxLength: number) => {
    return text.length > maxLength
      ? text.substring(0, maxLength) + "..."
      : text;
  };

  const triggerEmailSync = async () => {
    try {
      const response = await fetch("/api/email/sync", { method: "POST" });
      const result = await response.json();

      if (response.status === 401) {
        // Not authenticated, redirect to auth
        if (
          confirm(
            `${result.message}\n\nClick OK to authenticate with Gmail now.`,
          )
        ) {
          window.open("/api/auth/gmail", "_blank");
        }
      } else if (response.ok) {
        alert(`✅ ${result.message}`);
      } else {
        alert(`❌ ${result.message || result.error || "Sync failed"}`);
      }
    } catch (error) {
      alert(`❌ Email sync failed: ${error}`);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                SAP Automation Dashboard
              </h1>
              <span className="ml-4 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                Step 1: Customer Interaction Layer
              </span>
            </div>
            <button
              onClick={triggerEmailSync}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              Sync Gmail
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Navigation Tabs */}
        <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg mb-8">
          {["overview", "messages", "customers", "logs"].map((tab) => (
            <button
              key={tab}
              onClick={() => setSelectedTab(tab)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                selectedTab === tab
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {selectedTab === "overview" && (
          <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide">
                  Total Messages
                </h3>
                <p className="mt-2 text-3xl font-bold text-gray-900">
                  {messageStats?.total || 0}
                </p>
                <p className="mt-1 text-sm text-gray-600">
                  Today: {messageStats?.todayCount || 0}
                </p>
              </div>

              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide">
                  Total Customers
                </h3>
                <p className="mt-2 text-3xl font-bold text-gray-900">
                  {customerStats?.total || 0}
                </p>
                <p className="mt-1 text-sm text-gray-600">
                  New this week: {customerStats?.newThisWeek || 0}
                </p>
              </div>

              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide">
                  Email Messages
                </h3>
                <p className="mt-2 text-3xl font-bold text-blue-600">
                  {messageStats?.byChannel?.email || 0}
                </p>
                <p className="mt-1 text-sm text-gray-600">
                  Processed: {messageStats?.byStatus?.completed || 0}
                </p>
              </div>

              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide">
                  System Status
                </h3>
                <p className="mt-2 text-3xl font-bold text-green-600">
                  {systemLogs && systemLogs.length === 0 ? "Healthy" : "Issues"}
                </p>
                <p className="mt-1 text-sm text-gray-600">
                  Errors: {systemLogs?.length || 0}
                </p>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-lg shadow">
                <div className="p-6 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900">
                    Recent Messages
                  </h3>
                </div>
                <div className="divide-y divide-gray-200">
                  {messages?.slice(0, 5).map((message) => (
                    <div key={message._id} className="p-4">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-gray-900">
                          {message.customerName ||
                            message.customerEmail ||
                            "Unknown"}
                        </p>
                        <span
                          className={`px-2 py-1 text-xs rounded-full ${
                            message.status === "completed"
                              ? "bg-green-100 text-green-800"
                              : message.status === "failed"
                                ? "bg-red-100 text-red-800"
                                : "bg-yellow-100 text-yellow-800"
                          }`}
                        >
                          {message.status}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-gray-600">
                        {truncateText(message.body, 100)}
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        {formatDate(message.receivedAt)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-lg shadow">
                <div className="p-6 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900">
                    Recent Customers
                  </h3>
                </div>
                <div className="divide-y divide-gray-200">
                  {recentCustomers?.map((customer) => (
                    <div key={customer._id} className="p-4">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-gray-900">
                          {customer.name}
                        </p>
                        <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">
                          {customer.preferredChannel}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-gray-600">
                        {customer.email || customer.phone}
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        Messages: {customer.messageCount || 0}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Messages Tab */}
        {selectedTab === "messages" && (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">
                All Messages
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Customer
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Channel
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Subject/Message
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Received
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {messages?.map((message) => (
                    <tr key={message._id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {message.customerName || "Unknown"}
                          </p>
                          <p className="text-sm text-gray-500">
                            {message.customerEmail || message.customerPhone}
                          </p>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 py-1 text-xs rounded-full ${
                            message.channel === "email"
                              ? "bg-blue-100 text-blue-800"
                              : "bg-green-100 text-green-800"
                          }`}
                        >
                          {message.channel}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-gray-900">
                          {message.subject || truncateText(message.body, 50)}
                        </p>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 py-1 text-xs rounded-full ${
                            message.status === "completed"
                              ? "bg-green-100 text-green-800"
                              : message.status === "failed"
                                ? "bg-red-100 text-red-800"
                                : "bg-yellow-100 text-yellow-800"
                          }`}
                        >
                          {message.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(message.receivedAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Customers Tab */}
        {selectedTab === "customers" && (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">
                Customer Directory
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Contact
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Preferred Channel
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Messages
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Last Contact
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {recentCustomers?.map((customer) => (
                    <tr key={customer._id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <p className="text-sm font-medium text-gray-900">
                          {customer.name}
                        </p>
                        {customer.company && (
                          <p className="text-sm text-gray-500">
                            {customer.company}
                          </p>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {customer.email || customer.phone}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 py-1 text-xs rounded-full ${
                            customer.preferredChannel === "email"
                              ? "bg-blue-100 text-blue-800"
                              : "bg-green-100 text-green-800"
                          }`}
                        >
                          {customer.preferredChannel}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {customer.messageCount || 0}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(customer.lastContactAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Logs Tab */}
        {selectedTab === "logs" && (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">System Logs</h3>
            </div>
            <div className="divide-y divide-gray-200">
              {systemLogs?.map((log) => (
                <div key={log._id} className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center">
                        <span
                          className={`px-2 py-1 text-xs rounded-full mr-2 ${
                            log.level === "error"
                              ? "bg-red-100 text-red-800"
                              : log.level === "warning"
                                ? "bg-yellow-100 text-yellow-800"
                                : "bg-green-100 text-green-800"
                          }`}
                        >
                          {log.level}
                        </span>
                        <span className="px-2 py-1 text-xs bg-gray-100 text-gray-800 rounded-full">
                          {log.source}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-gray-900">
                        {log.message}
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        {formatDate(log.timestamp)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
