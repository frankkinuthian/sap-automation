import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Create a new log entry
export const create = mutation({
  args: {
    level: v.union(v.literal("info"), v.literal("warning"), v.literal("error")),
    message: v.string(),
    source: v.string(),
    data: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    try {
      const logId = await ctx.db.insert("systemLogs", {
        ...args,
        timestamp: Date.now(),
      });

      return logId;
    } catch (error) {
      // If logging fails, we still want the system to continue
      console.error("Failed to create system log:", error);
      throw error;
    }
  },
});

// Get all logs with pagination
export const getAllLogs = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 100;
    return await ctx.db.query("systemLogs").order("desc").take(limit);
  },
});

// Get logs by level
export const getByLevel = query({
  args: {
    level: v.union(v.literal("info"), v.literal("warning"), v.literal("error")),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 100;
    return await ctx.db
      .query("systemLogs")
      .withIndex("by_level", (q) => q.eq("level", args.level))
      .order("desc")
      .take(limit);
  },
});

// Get logs by source
export const getBySource = query({
  args: {
    source: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 100;
    return await ctx.db
      .query("systemLogs")
      .withIndex("by_source", (q) => q.eq("source", args.source))
      .order("desc")
      .take(limit);
  },
});

// Get logs within a time range
export const getByTimeRange = query({
  args: {
    startTime: v.number(),
    endTime: v.number(),
    level: v.optional(
      v.union(v.literal("info"), v.literal("warning"), v.literal("error")),
    ),
    source: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const allLogs = await ctx.db.query("systemLogs").collect();

    let filteredLogs = allLogs.filter(
      (log) => log.timestamp >= args.startTime && log.timestamp <= args.endTime,
    );

    if (args.level) {
      filteredLogs = filteredLogs.filter((log) => log.level === args.level);
    }

    if (args.source) {
      filteredLogs = filteredLogs.filter((log) => log.source === args.source);
    }

    return filteredLogs.sort((a, b) => b.timestamp - a.timestamp);
  },
});

// Get recent error logs
export const getRecentErrors = query({
  args: {
    limit: v.optional(v.number()),
    hours: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 50;
    const hours = args.hours || 24;
    const cutoffTime = Date.now() - hours * 60 * 60 * 1000;

    const errorLogs = await ctx.db
      .query("systemLogs")
      .withIndex("by_level", (q) => q.eq("level", "error"))
      .collect();

    return errorLogs
      .filter((log) => log.timestamp >= cutoffTime)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  },
});

// Get system log statistics
export const getStats = query({
  args: {
    hours: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const hours = args.hours || 24;
    const cutoffTime = Date.now() - hours * 60 * 60 * 1000;

    const recentLogs = await ctx.db.query("systemLogs").collect();

    const filteredLogs = recentLogs.filter(
      (log) => log.timestamp >= cutoffTime,
    );

    const stats = {
      total: filteredLogs.length,
      byLevel: {
        info: 0,
        warning: 0,
        error: 0,
      },
      bySource: {} as Record<string, number>,
      timeRange: {
        hours,
        startTime: cutoffTime,
        endTime: Date.now(),
      },
      errorRate: 0,
    };

    filteredLogs.forEach((log) => {
      // Count by level
      stats.byLevel[log.level]++;

      // Count by source
      if (!stats.bySource[log.source]) {
        stats.bySource[log.source] = 0;
      }
      stats.bySource[log.source]++;
    });

    // Calculate error rate
    stats.errorRate =
      stats.total > 0 ? (stats.byLevel.error / stats.total) * 100 : 0;

    return stats;
  },
});

// Search logs by message content
export const searchLogs = query({
  args: {
    searchTerm: v.string(),
    level: v.optional(
      v.union(v.literal("info"), v.literal("warning"), v.literal("error")),
    ),
    source: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 100;
    const logs = await ctx.db.query("systemLogs").collect();
    const searchLower = args.searchTerm.toLowerCase();

    return logs
      .filter((log) => {
        const matchesSearch = log.message.toLowerCase().includes(searchLower);
        const matchesLevel = args.level ? log.level === args.level : true;
        const matchesSource = args.source ? log.source === args.source : true;

        return matchesSearch && matchesLevel && matchesSource;
      })
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  },
});

// Clean up old logs (keep only recent ones)
export const cleanup = mutation({
  args: {
    keepDays: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const keepDays = args.keepDays || 30;
    const cutoffTime = Date.now() - keepDays * 24 * 60 * 60 * 1000;

    const oldLogs = await ctx.db.query("systemLogs").collect();
    const logsToDelete = oldLogs.filter((log) => log.timestamp < cutoffTime);

    let deletedCount = 0;
    for (const log of logsToDelete) {
      await ctx.db.delete(log._id);
      deletedCount++;
    }

    // Log the cleanup operation
    await ctx.db.insert("systemLogs", {
      level: "info",
      message: `Log cleanup completed: deleted ${deletedCount} old logs`,
      source: "system_maintenance",
      data: {
        deletedCount,
        keepDays,
        cutoffTime,
      },
      timestamp: Date.now(),
    });

    return {
      deletedCount,
      cutoffTime,
      keepDays,
    };
  },
});

// Get log summary for dashboard
export const getSummary = query({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;

    const allLogs = await ctx.db.query("systemLogs").collect();

    const summary = {
      lastHour: {
        total: 0,
        errors: 0,
        warnings: 0,
      },
      lastDay: {
        total: 0,
        errors: 0,
        warnings: 0,
      },
      lastWeek: {
        total: 0,
        errors: 0,
        warnings: 0,
      },
      topSources: {} as Record<string, number>,
      recentErrors: [] as any[],
    };

    const recentErrors: any[] = [];

    allLogs.forEach((log) => {
      // Count by time periods
      if (log.timestamp >= oneHourAgo) {
        summary.lastHour.total++;
        if (log.level === "error") summary.lastHour.errors++;
        if (log.level === "warning") summary.lastHour.warnings++;
      }

      if (log.timestamp >= oneDayAgo) {
        summary.lastDay.total++;
        if (log.level === "error") summary.lastDay.errors++;
        if (log.level === "warning") summary.lastDay.warnings++;
      }

      if (log.timestamp >= oneWeekAgo) {
        summary.lastWeek.total++;
        if (log.level === "error") summary.lastWeek.errors++;
        if (log.level === "warning") summary.lastWeek.warnings++;

        // Count sources for the week
        if (!summary.topSources[log.source]) {
          summary.topSources[log.source] = 0;
        }
        summary.topSources[log.source]++;
      }

      // Collect recent errors
      if (log.level === "error" && log.timestamp >= oneDayAgo) {
        recentErrors.push(log);
      }
    });

    // Sort recent errors by timestamp and take top 5
    summary.recentErrors = recentErrors
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 5);

    return summary;
  },
});
