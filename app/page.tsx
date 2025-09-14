"use client";

import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, AlertCircle, Mail, Users, Activity, Clock } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from 'sonner';

type Status = 'received' | 'processing' | 'parsed' | 'completed' | 'failed';

const statusVariant: Record<Status, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  received: 'secondary',
  processing: 'secondary',
  parsed: 'outline',
  completed: 'default',
  failed: 'destructive',
};

export default function Dashboard() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(
    typeof window !== 'undefined' ? Number(localStorage.getItem('lastSyncTime')) || null : null
  );
  const [refreshTrigger, setRefreshTrigger] = useState(Date.now());

  const updateLastSyncTime = (time: number | null) => {
    setLastSyncTime(time);
    if (typeof window !== 'undefined') {
      if (time) {
        localStorage.setItem('lastSyncTime', time.toString());
      } else {
        localStorage.removeItem('lastSyncTime');
      }
    }
  };

  // Fetch data with loading states
  const messages = useQuery(api.messages.getAllMessages, { limit: 10 });
  const messageStats = useQuery(api.messages.getStats);
  const customerStats = useQuery(api.customers.getStats);
  const recentCustomers = useQuery(api.customers.getRecentCustomers, { limit: 5 });
  const systemLogs = useQuery(api.systemLogs.getRecentErrors, { limit: 5, hours: 24 });

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  const truncateText = (text: string, maxLength: number = 50) => {
    if (!text) return '';
    return text.length > maxLength ? `${text.substring(0, maxLength)}...` : text;
  };

  const triggerEmailSync = async () => {
    setIsSyncing(true);
    const syncStartTime = Date.now();
    const toastId = toast.loading('Syncing emails...');
    
    try {
      const response = await fetch("/api/email/sync", { method: "POST" });
      const result = await response.json();

      if (response.status === 401) {
        toast.error('Authentication Required', {
          description: result.message,
          action: {
            label: 'Authenticate',
            onClick: () => window.open("/api/auth/gmail", "_blank")
          },
          duration: 10000
        });
      } else if (response.ok) {
        updateLastSyncTime(syncStartTime);
        setRefreshTrigger(syncStartTime);
        toast.success('Sync completed', {
          description: result.message || 'Your emails have been synced successfully',
          id: toastId
        });
      } else {
        throw new Error(result.message || "Sync failed");
      }
    } catch (error) {
      console.error("Sync error:", error);
      toast.error('Sync failed', {
        description: error instanceof Error ? error.message : 'An unknown error occurred',
        id: toastId
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const renderLoadingSkeleton = () => (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-[110px] w-full rounded-xl" />
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Skeleton className="col-span-4 h-[400px]" />
        <Skeleton className="col-span-3 h-[400px]" />
      </div>
    </div>
  );

  const renderEmptyState = (message: string, icon: React.ReactNode) => (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="mb-4 rounded-full bg-muted p-4">
        {icon}
      </div>
      <h3 className="text-lg font-medium">No data available</h3>
      <p className="text-muted-foreground text-sm">{message}</p>
    </div>
  );

  const renderStatsCard = (title: string, value: string | number, icon: React.ReactNode, description?: string) => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className="text-muted-foreground">{icon}</div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && <p className="text-muted-foreground text-xs">{description}</p>}
      </CardContent>
    </Card>
  );

  if (!messages || !messageStats || !customerStats || !recentCustomers || !systemLogs) {
    return renderLoadingSkeleton();
  }

  return (
    <div className="flex-1 space-y-4 p-4 pt-6 md:p-8">
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
          <p className="text-muted-foreground">
            Monitor and manage your SAP automation workflow
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button onClick={triggerEmailSync} disabled={isSyncing}>
            {isSyncing ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Syncing...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Sync Now
              </>
            )}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-4" onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="messages">Messages</TabsTrigger>
          <TabsTrigger value="customers">Customers</TabsTrigger>
          <TabsTrigger value="logs">System Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {renderStatsCard(
              "Total Messages",
              messageStats?.total || 0,
              <Mail className="h-4 w-4" />,
              `${messageStats?.byStatus?.received || 0} new messages today`
            )}
            {renderStatsCard(
              "Active Customers",
              customerStats?.total || 0,
              <Users className="h-4 w-4" />,
              `${customerStats?.newThisWeek || 0} new this week`
            )}
            {renderStatsCard(
              "Message Status",
              `${messageStats?.byStatus?.completed || 0} completed`,
              <Activity className="h-4 w-4" />,
              `${messageStats?.byStatus?.processing || 0} in progress`
            )}
            {renderStatsCard(
              "Last Sync",
              lastSyncTime ? new Date(lastSyncTime).toLocaleTimeString() : 'Never',
              <Clock className="h-4 w-4" />,
              lastSyncTime ? `at ${new Date(lastSyncTime).toLocaleDateString()}` : 'No sync data'
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
            <Card className="col-span-4">
              <CardHeader>
                <CardTitle>Recent Messages</CardTitle>
              </CardHeader>
              <CardContent>
                {messages.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>From</TableHead>
                        <TableHead>Subject</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Received</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {messages.map((message) => (
                        <TableRow key={message._id}>
                          <TableCell className="font-medium">
                            {message.customerName || message.customerEmail || 'Unknown'}
                          </TableCell>
                          <TableCell>{truncateText(message.subject || 'No subject')}</TableCell>
                          <TableCell>
                            <Badge variant={statusVariant[message.status as Status] || 'outline'}>
                              {message.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right text-sm text-muted-foreground">
                            {formatDate(message.receivedAt)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  renderEmptyState(
                    "No messages found. Try syncing your email account.",
                    <Mail className="h-6 w-6" />
                  )
                )}
              </CardContent>
            </Card>

            <Card className="col-span-3">
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>System logs and notifications</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {systemLogs.length > 0 ? (
                  systemLogs.map((log) => (
                    <div key={log._id} className="flex items-start space-x-3">
                      <div className="flex-shrink-0 pt-0.5">
                        {log.level === 'error' ? (
                          <AlertCircle className="h-4 w-4 text-destructive" />
                        ) : (
                          <Activity className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-medium leading-none">
                          {log.message}
                        </p>
                        <p className="text-muted-foreground text-xs">
                          {formatDate(log.timestamp)}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  renderEmptyState(
                    "No recent activity to display.",
                    <Activity className="h-6 w-6" />
                  )
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="messages" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>All Messages</CardTitle>
                  <CardDescription>
                    View and manage all processed messages
                  </CardDescription>
                </div>
                <div className="flex space-x-2">
                  <Button variant="outline" size="sm">
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Refresh
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {messages.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>From</TableHead>
                      <TableHead>Subject</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Received</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {messages.map((message) => (
                      <TableRow key={message._id}>
                        <TableCell className="font-medium">
                          {message.customerName || message.customerEmail || 'Unknown'}
                        </TableCell>
                        <TableCell>{truncateText(message.subject || 'No subject')}</TableCell>
                        <TableCell>
                          <Badge variant={statusVariant[message.status as Status] || 'outline'}>
                            {message.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right text-sm text-muted-foreground">
                          {formatDate(message.receivedAt)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                renderEmptyState(
                  "No messages found. Try syncing your email account.",
                  <Mail className="h-6 w-6" />
                )
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="customers" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Customers</CardTitle>
            </CardHeader>
            <CardContent>
              {recentCustomers.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>SAP Code</TableHead>
                      <TableHead>Last Contact</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentCustomers.map((customer) => (
                      <TableRow key={customer._id}>
                        <TableCell className="font-medium">
                          {customer.name || 'Unnamed Customer'}
                        </TableCell>
                        <TableCell>{customer.email || 'No email'}</TableCell>
                        <TableCell>{customer.phone || 'No phone'}</TableCell>
                        <TableCell>
                          <Badge variant={customer.sapCustomerCode ? 'default' : 'outline'}>
                            {customer.sapCustomerCode || 'No SAP code'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {new Date(customer.lastContactAt).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                renderEmptyState(
                  "No recent customers to display.",
                  <Users className="h-6 w-6" />
                )
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>System Logs</CardTitle>
            </CardHeader>
            <CardContent>
              {systemLogs.length > 0 ? (
                <div className="space-y-4">
                  {Object.entries(messageStats?.byStatus || {}).map(([status, count]) => (
                    <div key={status} className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground capitalize">{status}</span>
                      <Badge variant={status === 'completed' ? 'default' : 'secondary'}>
                        {count as number}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                renderEmptyState(
                  "No system logs to display.",
                  <Activity className="h-6 w-6" />
                )
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
