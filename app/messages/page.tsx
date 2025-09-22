"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Mail } from "lucide-react";

export default function MessagesPage() {
  const messages = useQuery(api.messages.getMessagesFiltered, { limit: 20, includeArchived: false });

  const formatDate = (timestamp: number) => new Date(timestamp).toLocaleString();
  const truncateText = (text: string, max: number = 80) => (text?.length > max ? text.slice(0, max) + "..." : text);

  const renderLoading = () => (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-[110px] w-full rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-[400px] w-full" />
    </div>
  );

  if (!messages) return renderLoading();

  return (
    <div className="flex-1 space-y-4 p-4 pt-6 md:p-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Messages</h2>
          <p className="text-muted-foreground">Browse all messages and open details</p>
        </div>
      </div>

      <Tabs defaultValue="list" className="space-y-4">
        <TabsContent value="list">
          <Card>
            <CardHeader>
              <CardTitle>All Messages</CardTitle>
              <CardDescription>Latest 20 messages</CardDescription>
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
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {messages.map((m) => (
                      <TableRow key={m._id} className="hover:bg-muted/50">
                        <TableCell className="font-medium">
                          <Link href={`/messages/${m._id}`} className="hover:underline">
                            {m.customerName || m.customerEmail || "Unknown"}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <Link href={`/messages/${m._id}`} className="hover:underline">
                            {truncateText(m.subject || "No subject")}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <Badge variant={m.status === "completed" ? "default" : m.status === "failed" ? "destructive" : "secondary"}>
                            {m.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right text-sm text-muted-foreground">
                          {formatDate(m.receivedAt)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Link href={`/messages/${m._id}`}>
                            <Button variant="outline" size="sm">View</Button>
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="mb-4 rounded-full bg-muted p-4">
                    <Mail className="h-6 w-6" />
                  </div>
                  <h3 className="text-lg font-medium">No messages</h3>
                  <p className="text-muted-foreground text-sm">Try syncing your email account from the Dashboard</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
