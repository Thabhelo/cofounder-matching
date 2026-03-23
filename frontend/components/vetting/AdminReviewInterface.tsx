/**
 * Admin Review Interface Component
 *
 * Comprehensive admin interface for reviewing users, managing the review queue,
 * and performing moderation actions with proper workflow and audit logging.
 */

'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  User,
  Shield,
  ShieldCheck,
  ShieldX,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Eye,
  MessageSquare,
  Flag,
  Ban,
  MoreHorizontal,
  FileText,
  Calendar,
  Mail,
  ExternalLink,
  History,
  TrendingUp,
  TrendingDown,
  Filter,
  Search,
  RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ReviewQueueItem {
  id: string;
  user_id: string;
  user_email: string;
  user_name: string;
  queue_reason: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  current_trust_score: number;
  profile_completeness: number;
  report_count: number;
  flags: string[];
  created_at: Date;
  last_updated: Date;
  assigned_to?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'deferred';
  admin_notes?: string;
}

interface AdminReviewInterfaceProps {
  queueItems?: ReviewQueueItem[];
  onItemAction?: (itemId: string, action: string, notes?: string) => Promise<void>;
  onBulkAction?: (itemIds: string[], action: string) => Promise<void>;
  onRefresh?: () => Promise<void>;
  currentAdmin?: {
    id: string;
    name: string;
    role: string;
  };
  className?: string;
}

const AdminReviewInterface: React.FC<AdminReviewInterfaceProps> = ({
  queueItems = [],
  onItemAction,
  onBulkAction,
  onRefresh,
  currentAdmin,
  className,
}) => {
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [sortBy, setSortBy] = useState<'created_at' | 'priority' | 'trust_score'>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Filter and sort items
  const filteredItems = queueItems
    .filter(item => {
      if (filterStatus !== 'all' && item.status !== filterStatus) return false;
      if (filterPriority !== 'all' && item.priority !== filterPriority) return false;
      if (searchQuery && !item.user_email.toLowerCase().includes(searchQuery.toLowerCase()) &&
          !item.user_name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    })
    .sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'created_at':
          comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          break;
        case 'priority':
          const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
          comparison = priorityOrder[a.priority] - priorityOrder[b.priority];
          break;
        case 'trust_score':
          comparison = a.current_trust_score - b.current_trust_score;
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

  const handleRefresh = async () => {
    if (!onRefresh) return;
    setIsRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setIsRefreshing(false);
    }
  };

  const toggleItemSelection = (itemId: string) => {
    const newSelection = new Set(selectedItems);
    if (newSelection.has(itemId)) {
      newSelection.delete(itemId);
    } else {
      newSelection.add(itemId);
    }
    setSelectedItems(newSelection);
  };

  const selectAllVisible = () => {
    setSelectedItems(new Set(filteredItems.map(item => item.id)));
  };

  const clearSelection = () => {
    setSelectedItems(new Set());
  };

  const handleBulkAction = async (action: string) => {
    if (!onBulkAction || selectedItems.size === 0) return;
    await onBulkAction(Array.from(selectedItems), action);
    clearSelection();
  };

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header and Controls */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Admin Review Queue</h2>
          <p className="text-muted-foreground">
            {filteredItems.length} items • {selectedItems.size} selected
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={cn('w-4 h-4 mr-1', isRefreshing && 'animate-spin')} />
            Refresh
          </Button>

          {currentAdmin && (
            <Badge variant="outline">
              <User className="w-3 h-3 mr-1" />
              {currentAdmin.name}
            </Badge>
          )}
        </div>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Search className="w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search users..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-64"
              />
            </div>

            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="deferred">Deferred</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterPriority} onValueChange={setFilterPriority}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priority</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="created_at">Date</SelectItem>
                <SelectItem value="priority">Priority</SelectItem>
                <SelectItem value="trust_score">Trust Score</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            >
              {sortOrder === 'asc' ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Bulk Actions */}
      {selectedItems.size > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg border border-blue-200"
        >
          <span className="text-sm font-medium">
            {selectedItems.size} item(s) selected
          </span>
          <Separator orientation="vertical" className="h-4" />
          <Button size="sm" variant="outline" onClick={clearSelection}>
            Clear
          </Button>
          <Button size="sm" variant="outline" onClick={selectAllVisible}>
            Select All Visible
          </Button>
          <Separator orientation="vertical" className="h-4" />
          <Button size="sm" onClick={() => handleBulkAction('approve')}>
            <CheckCircle2 className="w-4 h-4 mr-1" />
            Approve
          </Button>
          <Button size="sm" variant="destructive" onClick={() => handleBulkAction('reject')}>
            <XCircle className="w-4 h-4 mr-1" />
            Reject
          </Button>
          <Button size="sm" variant="outline" onClick={() => handleBulkAction('defer')}>
            <Clock className="w-4 h-4 mr-1" />
            Defer
          </Button>
        </motion.div>
      )}

      {/* Queue Items */}
      <div className="space-y-4">
        <AnimatePresence>
          {filteredItems.map((item) => (
            <ReviewQueueItemCard
              key={item.id}
              item={item}
              isSelected={selectedItems.has(item.id)}
              onSelect={() => toggleItemSelection(item.id)}
              onAction={onItemAction}
              currentAdmin={currentAdmin}
            />
          ))}
        </AnimatePresence>

        {filteredItems.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <Shield className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No items in queue</h3>
              <p className="text-muted-foreground">
                {queueItems.length === 0
                  ? "All caught up! No users need review."
                  : "No items match your current filters."}
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

// Individual Queue Item Card
const ReviewQueueItemCard: React.FC<{
  item: ReviewQueueItem;
  isSelected: boolean;
  onSelect: () => void;
  onAction?: (itemId: string, action: string, notes?: string) => Promise<void>;
  currentAdmin?: { id: string; name: string; role: string };
}> = ({ item, isSelected, onSelect, onAction, currentAdmin }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [actionNotes, setActionNotes] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const priorityConfig = getPriorityConfig(item.priority);
  const statusConfig = getStatusConfig(item.status);
  const trustLevel = getTrustLevel(item.current_trust_score);

  const handleAction = async (action: string) => {
    if (!onAction || isProcessing) return;

    setIsProcessing(true);
    try {
      await onAction(item.id, action, actionNotes || undefined);
      setActionNotes('');
    } finally {
      setIsProcessing(false);
    }
  };

  const daysSinceCreated = Math.floor(
    (new Date().getTime() - new Date(item.created_at).getTime()) / (1000 * 60 * 60 * 24)
  );

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className={cn(
        'transition-all',
        isSelected && 'ring-2 ring-blue-200'
      )}
    >
      <Card className={cn(
        'cursor-pointer transition-all hover:shadow-md',
        isSelected && 'ring-2 ring-blue-500',
        item.priority === 'critical' && 'ring-1 ring-red-200',
        item.status === 'completed' && 'opacity-75'
      )}>
        <CardHeader className="pb-3" onClick={onSelect}>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={isSelected}
                onChange={onSelect}
                className="w-4 h-4"
                onClick={(e) => e.stopPropagation()}
              />

              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{item.user_name}</span>
                  <Badge variant="outline" className="text-xs">
                    {item.user_email}
                  </Badge>
                </div>

                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>{item.queue_reason}</span>
                  {daysSinceCreated > 0 && (
                    <>
                      <span>•</span>
                      <span>{daysSinceCreated} days ago</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Badge className={priorityConfig.style}>
                {item.priority}
              </Badge>
              <Badge variant="outline" className={statusConfig.style}>
                <statusConfig.icon className="w-3 h-3 mr-1" />
                {item.status}
              </Badge>
            </div>
          </div>

          <div className="flex items-center justify-between mt-3">
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1">
                <Shield className={cn('w-4 h-4', trustLevel.iconColor)} />
                <span>Trust: {item.current_trust_score}</span>
              </div>
              <div>Profile: {item.profile_completeness}%</div>
              {item.report_count > 0 && (
                <div className="flex items-center gap-1 text-red-600">
                  <Flag className="w-4 h-4" />
                  <span>{item.report_count} reports</span>
                </div>
              )}
              {item.flags.length > 0 && (
                <div className="flex items-center gap-1 text-orange-600">
                  <AlertTriangle className="w-4 h-4" />
                  <span>{item.flags.length} flags</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsExpanded(!isExpanded);
                }}
              >
                <Eye className="w-4 h-4 mr-1" />
                {isExpanded ? 'Less' : 'Details'}
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" onClick={(e) => e.stopPropagation()}>
                    <MoreHorizontal className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Quick Actions</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => handleAction('approve')}>
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Approve
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleAction('reject')}>
                    <XCircle className="w-4 h-4 mr-2" />
                    Reject
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleAction('flag')}>
                    <Flag className="w-4 h-4 mr-2" />
                    Add Flag
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem>
                    <ExternalLink className="w-4 h-4 mr-2" />
                    View Profile
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <History className="w-4 h-4 mr-2" />
                    View History
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardHeader>

        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
            >
              <CardContent className="pt-0">
                <ReviewItemDetails item={item} />
              </CardContent>

              <CardFooter className="pt-4">
                <div className="w-full space-y-3">
                  <div>
                    <Label htmlFor={`notes-${item.id}`} className="text-sm">
                      Admin Notes
                    </Label>
                    <Textarea
                      id={`notes-${item.id}`}
                      value={actionNotes}
                      onChange={(e) => setActionNotes(e.target.value)}
                      placeholder="Add notes about this review decision..."
                      className="mt-1"
                      rows={2}
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      onClick={() => handleAction('approve')}
                      disabled={isProcessing}
                      size="sm"
                    >
                      <CheckCircle2 className="w-4 h-4 mr-1" />
                      Approve
                    </Button>

                    <Button
                      variant="destructive"
                      onClick={() => handleAction('reject')}
                      disabled={isProcessing}
                      size="sm"
                    >
                      <XCircle className="w-4 h-4 mr-1" />
                      Reject
                    </Button>

                    <Button
                      variant="outline"
                      onClick={() => handleAction('defer')}
                      disabled={isProcessing}
                      size="sm"
                    >
                      <Clock className="w-4 h-4 mr-1" />
                      Defer
                    </Button>

                    <Separator orientation="vertical" className="h-6" />

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm" className="text-red-600">
                          <Ban className="w-4 h-4 mr-1" />
                          Ban User
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Ban User</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently ban {item.user_name} from the platform.
                            This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleAction('ban')}
                            className="bg-red-600 hover:bg-red-700"
                          >
                            Ban User
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>

                    {isProcessing && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground ml-auto">
                        <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
                        Processing...
                      </div>
                    )}
                  </div>
                </div>
              </CardFooter>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </motion.div>
  );
};

// Detailed Item Information
const ReviewItemDetails: React.FC<{
  item: ReviewQueueItem;
}> = ({ item }) => {
  return (
    <Tabs defaultValue="overview" className="w-full">
      <TabsList className="grid w-full grid-cols-4">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="flags">Flags</TabsTrigger>
        <TabsTrigger value="history">History</TabsTrigger>
        <TabsTrigger value="notes">Notes</TabsTrigger>
      </TabsList>

      <TabsContent value="overview" className="space-y-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="space-y-2">
            <h4 className="font-semibold">Trust Metrics</h4>
            <div>Trust Score: {item.current_trust_score}/100</div>
            <div>Profile Complete: {item.profile_completeness}%</div>
            <div>Reports: {item.report_count}</div>
          </div>
          <div className="space-y-2">
            <h4 className="font-semibold">Queue Info</h4>
            <div>Reason: {item.queue_reason}</div>
            <div>Priority: {item.priority}</div>
            <div>Assigned: {item.assigned_to || 'Unassigned'}</div>
          </div>
        </div>
      </TabsContent>

      <TabsContent value="flags" className="space-y-3">
        {item.flags.length > 0 ? (
          item.flags.map((flag, index) => (
            <div key={index} className="flex items-center gap-2 p-2 bg-yellow-50 rounded border">
              <AlertTriangle className="w-4 h-4 text-yellow-600" />
              <span className="text-sm">{flag}</span>
            </div>
          ))
        ) : (
          <p className="text-muted-foreground text-sm">No flags on this user.</p>
        )}
      </TabsContent>

      <TabsContent value="history" className="space-y-3">
        <div className="text-sm text-muted-foreground">
          <div>Created: {new Date(item.created_at).toLocaleDateString()}</div>
          <div>Updated: {new Date(item.last_updated).toLocaleDateString()}</div>
        </div>
        <p className="text-sm text-muted-foreground">
          Detailed history would be loaded from API...
        </p>
      </TabsContent>

      <TabsContent value="notes" className="space-y-3">
        {item.admin_notes ? (
          <div className="p-3 bg-gray-50 rounded border">
            <p className="text-sm">{item.admin_notes}</p>
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">No admin notes yet.</p>
        )}
      </TabsContent>
    </Tabs>
  );
};

// Utility functions
const getPriorityConfig = (priority: string) => {
  const configs = {
    critical: { style: 'bg-red-100 text-red-800 border-red-200' },
    high: { style: 'bg-orange-100 text-orange-800 border-orange-200' },
    medium: { style: 'bg-blue-100 text-blue-800 border-blue-200' },
    low: { style: 'bg-gray-100 text-gray-800 border-gray-200' },
  };
  return configs[priority as keyof typeof configs] || configs.medium;
};

const getStatusConfig = (status: string) => {
  const configs = {
    pending: { icon: Clock, style: 'text-yellow-700' },
    in_progress: { icon: RefreshCw, style: 'text-blue-700' },
    completed: { icon: CheckCircle2, style: 'text-green-700' },
    deferred: { icon: Calendar, style: 'text-gray-700' },
  };
  return configs[status as keyof typeof configs] || configs.pending;
};

const getTrustLevel = (score: number) => {
  if (score >= 70) return { iconColor: 'text-green-600' };
  if (score >= 50) return { iconColor: 'text-blue-600' };
  if (score >= 30) return { iconColor: 'text-yellow-600' };
  return { iconColor: 'text-red-600' };
};

export default AdminReviewInterface;