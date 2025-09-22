"use client";

import Link from "next/link";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Mail,
  Home,
  RefreshCw,
  Filter,
  Search,
  ArrowLeft,
  Trash2,
  Archive,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { toast } from "sonner";

type Status = "received" | "processing" | "parsed" | "completed" | "failed";

const statusVariant: Record<
  Status,
  "default" | "secondary" | "destructive" | "outline"
> = {
  received: "secondary",
  processing: "secondary",
  parsed: "outline",
  completed: "default",
  failed: "destructive",
};

export default function MessagesPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showArchived, setShowArchived] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const messages = useQuery(api.messages.getMessagesFiltered, {
    limit: 50,
    includeArchived: showArchived,
  });

  // Mutations for bulk actions
  const archiveByMessageIds = useMutation(api.messages.archiveByMessageIds);
  const deleteByMessageIds = useMutation(api.messages.deleteByMessageIds);

  const formatDate = (timestamp: number) =>
    new Date(timestamp).toLocaleString();
  const truncateText = (text: string, max: number = 60) =>
    text?.length > max ? text.slice(0, max) + "..." : text;

  // Filter messages based on search and status
  const filteredMessages =
    messages?.filter((message) => {
      const matchesSearch =
        !searchTerm ||
        message.customerName
          ?.toLowerCase()
          .includes(searchTerm.toLowerCase()) ||
        message.customerEmail
          ?.toLowerCase()
          .includes(searchTerm.toLowerCase()) ||
        message.subject?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus =
        statusFilter === "all" || message.status === statusFilter;

      return matchesSearch && matchesStatus;
    }) || [];

  // Get status counts
  const statusCounts =
    messages?.reduce((acc, message) => {
      acc[message.status] = (acc[message.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>) || {};

  // Selection functions
  const toggleSelection = (messageId: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const set = new Set(prev);
      if (checked) set.add(messageId);
      else set.delete(messageId);
      return Array.from(set);
    });
  };

  const toggleSelectAll = (checked: boolean) => {
    if (!filteredMessages || filteredMessages.length === 0) return;
    if (checked) setSelectedIds(filteredMessages.map((m) => m.messageId));
    else setSelectedIds([]);
  };

  // Bulk action handlers
  const handleArchiveSelected = async () => {
    if (selectedIds.length === 0) return;

    // Show confirmation toast with action buttons
    toast.info(
      `Archive ${selectedIds.length} message${
        selectedIds.length === 1 ? "" : "s"
      }?`,
      {
        description: `This will move ${selectedIds.length} message${
          selectedIds.length === 1 ? "" : "s"
        } to the archive. You can restore them later if needed.`,
        duration: 8000, // 8 seconds to decide
        action: {
          label: "Archive",
          onClick: async () => {
            const toastId = toast.loading(
              `Archiving ${selectedIds.length} message${
                selectedIds.length === 1 ? "" : "s"
              }...`
            );
            try {
              await archiveByMessageIds({ messageIds: selectedIds });
              toast.success(
                `Successfully archived ${selectedIds.length} message${
                  selectedIds.length === 1 ? "" : "s"
                }`,
                {
                  id: toastId,
                  description:
                    "The selected messages have been moved to the archive.",
                }
              );
              setSelectedIds([]);
            } catch (e) {
              toast.error("Failed to archive messages", {
                description:
                  e instanceof Error
                    ? e.message
                    : "An unexpected error occurred while archiving messages.",
                id: toastId,
              });
            }
          },
        },
        cancel: {
          label: "Cancel",
          onClick: () => {
            toast.success("Archive cancelled", {
              description: "No messages were archived.",
              duration: 3000,
            });
          },
        },
      }
    );
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.length === 0) return;

    // Show confirmation toast with action buttons
    toast.error(
      `Delete ${selectedIds.length} message${
        selectedIds.length === 1 ? "" : "s"
      }?`,
      {
        description: `This will permanently delete ${
          selectedIds.length
        } message${
          selectedIds.length === 1 ? "" : "s"
        } from your system. This action cannot be undone.`,
        duration: 10000, // 10 seconds to decide
        action: {
          label: "Delete",
          onClick: async () => {
            const toastId = toast.loading(
              `Deleting ${selectedIds.length} message${
                selectedIds.length === 1 ? "" : "s"
              }...`
            );
            try {
              await deleteByMessageIds({ messageIds: selectedIds });
              toast.success(
                `Successfully deleted ${selectedIds.length} message${
                  selectedIds.length === 1 ? "" : "s"
                }`,
                {
                  id: toastId,
                  description:
                    "The selected messages have been permanently removed from your system.",
                }
              );
              setSelectedIds([]);
            } catch (e) {
              toast.error("Failed to delete messages", {
                description:
                  e instanceof Error
                    ? e.message
                    : "An unexpected error occurred while deleting messages.",
                id: toastId,
              });
            }
          },
        },
        cancel: {
          label: "Cancel",
          onClick: () => {
            toast.success("Delete cancelled", {
              description: "No messages were deleted.",
              duration: 3000,
            });
          },
        },
      }
    );
  };

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
      {/* Header with navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link
            href="/"
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <Home className="mr-2 h-4 w-4" />
            Dashboard
          </Link>
          <div className="text-muted-foreground">/</div>
          <h2 className="text-3xl font-bold tracking-tight">Messages</h2>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.location.reload()}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Link href="/">
            <Button variant="outline" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Messages
            </CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{messages?.length || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Received</CardTitle>
            <div className="h-2 w-2 rounded-full bg-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {statusCounts.received || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Processing</CardTitle>
            <div className="h-2 w-2 rounded-full bg-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {statusCounts.processing || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Parsed</CardTitle>
            <div className="h-2 w-2 rounded-full bg-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statusCounts.parsed || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <div className="h-2 w-2 rounded-full bg-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {statusCounts.completed || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="all" className="space-y-4">
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="all" onClick={() => setStatusFilter("all")}>
              All ({messages?.length || 0})
            </TabsTrigger>
            <TabsTrigger
              value="received"
              onClick={() => setStatusFilter("received")}
            >
              Received ({statusCounts.received || 0})
            </TabsTrigger>
            <TabsTrigger
              value="processing"
              onClick={() => setStatusFilter("processing")}
            >
              Processing ({statusCounts.processing || 0})
            </TabsTrigger>
            <TabsTrigger
              value="parsed"
              onClick={() => setStatusFilter("parsed")}
            >
              Parsed ({statusCounts.parsed || 0})
            </TabsTrigger>
            <TabsTrigger
              value="completed"
              onClick={() => setStatusFilter("completed")}
            >
              Completed ({statusCounts.completed || 0})
            </TabsTrigger>
          </TabsList>

          <div className="flex items-center space-x-2">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search messages..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 w-64"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowArchived(!showArchived)}
            >
              <Filter className="mr-2 h-4 w-4" />
              {showArchived ? "Hide Archived" : "Show Archived"}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleArchiveSelected}
              disabled={selectedIds.length === 0}
            >
              <Archive className="mr-2 h-4 w-4" />
              Archive ({selectedIds.length})
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDeleteSelected}
              disabled={selectedIds.length === 0}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete ({selectedIds.length})
            </Button>
          </div>
        </div>

        <TabsContent value="all">
          <Card>
            <CardHeader>
              <CardTitle>All Messages</CardTitle>
              <CardDescription>
                {filteredMessages.length} of {messages?.length || 0} messages
                {searchTerm && ` matching "${searchTerm}"`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {filteredMessages.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[40px]">
                        <input
                          type="checkbox"
                          aria-label="Select all"
                          checked={
                            selectedIds.length > 0 &&
                            selectedIds.length === filteredMessages.length
                          }
                          onChange={(e) => toggleSelectAll(e.target.checked)}
                        />
                      </TableHead>
                      <TableHead>From</TableHead>
                      <TableHead>Subject</TableHead>
                      <TableHead>Channel</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>AI Analysis</TableHead>
                      <TableHead className="text-right">Received</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredMessages.map((m) => (
                      <TableRow key={m._id} className="hover:bg-muted/50">
                        <TableCell>
                          <input
                            type="checkbox"
                            aria-label="Select row"
                            checked={selectedIds.includes(m.messageId)}
                            onChange={(e) =>
                              toggleSelection(m.messageId, e.target.checked)
                            }
                          />
                        </TableCell>
                        <TableCell className="font-medium">
                          <div className="flex flex-col">
                            <Link
                              href={`/messages/${m._id}`}
                              className="hover:underline font-medium"
                            >
                              {m.customerName || "Unknown"}
                            </Link>
                            <span className="text-xs text-muted-foreground">
                              {m.customerEmail}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Link
                            href={`/messages/${m._id}`}
                            className="hover:underline"
                          >
                            {truncateText(m.subject || "No subject")}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {m.channel}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              statusVariant[m.status as Status] || "outline"
                            }
                          >
                            {m.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {m.aiParsedData ? (
                            <div className="flex items-center space-x-2">
                              <div className="h-2 w-2 rounded-full bg-green-500" />
                              <span className="text-xs text-muted-foreground">
                                {Math.round(
                                  (m.aiParsedData.confidenceScore || 0) * 100
                                )}
                                % confidence
                              </span>
                            </div>
                          ) : (
                            <div className="flex items-center space-x-2">
                              <div className="h-2 w-2 rounded-full bg-gray-300" />
                              <span className="text-xs text-muted-foreground">
                                Not analyzed
                              </span>
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right text-sm text-muted-foreground">
                          {formatDate(m.receivedAt)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Link href={`/messages/${m._id}`}>
                            <Button variant="outline" size="sm">
                              View Details
                            </Button>
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
                  <p className="text-muted-foreground text-sm">
                    Try syncing your email account from the Dashboard
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Add other tab contents that show filtered results */}
        <TabsContent value="received">
          <Card>
            <CardHeader>
              <CardTitle>Received Messages</CardTitle>
              <CardDescription>
                Messages waiting to be processed
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Use the &quot;All&quot; tab to view and filter messages.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="processing">
          <Card>
            <CardHeader>
              <CardTitle>Processing Messages</CardTitle>
              <CardDescription>
                Messages currently being analyzed
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Use the &quot;All&quot; tab to view and filter messages.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="parsed">
          <Card>
            <CardHeader>
              <CardTitle>Parsed Messages</CardTitle>
              <CardDescription>
                Messages that have been analyzed by AI
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Use the &quot;All&quot; tab to view and filter messages.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="completed">
          <Card>
            <CardHeader>
              <CardTitle>Completed Messages</CardTitle>
              <CardDescription>
                Messages that have been fully processed
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Use the &quot;All&quot; tab to view and filter messages.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
