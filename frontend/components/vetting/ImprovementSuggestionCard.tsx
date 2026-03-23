/**
 * Improvement Suggestion Card Component
 *
 * Displays actionable improvement suggestions with priority indicators,
 * progress tracking, and quick action buttons for user guidance.
 */

'use client';

import React, { useState } from 'react';
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
import { Progress } from '@/components/ui/progress';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  AlertCircle,
  ArrowUp,
  ArrowRight,
  Clock,
  CheckCircle2,
  ExternalLink,
  Info,
  Star,
  TrendingUp,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ImprovementSuggestion {
  category: 'profile' | 'verification' | 'trust' | 'professional' | 'activity';
  title: string;
  description: string;
  impact: 'critical' | 'high' | 'medium' | 'low';
  estimated_points: number;
  action_url?: string;
  is_required: boolean;
  deadline?: Date;
  completed?: boolean;
  in_progress?: boolean;
}

interface ImprovementSuggestionCardProps {
  suggestion: ImprovementSuggestion;
  onAction?: (suggestion: ImprovementSuggestion) => void;
  onDismiss?: (suggestion: ImprovementSuggestion) => void;
  onMarkComplete?: (suggestion: ImprovementSuggestion) => void;
  showProgress?: boolean;
  compact?: boolean;
  className?: string;
}

const ImprovementSuggestionCard: React.FC<ImprovementSuggestionCardProps> = ({
  suggestion,
  onAction,
  onDismiss,
  onMarkComplete,
  showProgress = false,
  compact = false,
  className,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const impactConfig = getImpactConfig(suggestion.impact);
  const categoryConfig = getCategoryConfig(suggestion.category);

  const handleAction = async () => {
    if (isProcessing) return;

    setIsProcessing(true);
    try {
      if (suggestion.action_url) {
        window.open(suggestion.action_url, '_blank');
      }
      if (onAction) {
        await onAction(suggestion);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleMarkComplete = async () => {
    if (isProcessing || suggestion.completed) return;

    setIsProcessing(true);
    try {
      if (onMarkComplete) {
        await onMarkComplete(suggestion);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDismiss = async () => {
    if (isProcessing) return;

    setIsProcessing(true);
    try {
      if (onDismiss) {
        await onDismiss(suggestion);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const timeUntilDeadline = suggestion.deadline
    ? Math.ceil((suggestion.deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  const isUrgent = timeUntilDeadline !== null && timeUntilDeadline <= 3;
  const isOverdue = timeUntilDeadline !== null && timeUntilDeadline < 0;

  if (compact) {
    return (
      <motion.div
        layout
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className={cn(
          'flex items-center gap-3 p-3 rounded-lg border bg-card transition-all hover:shadow-md',
          suggestion.completed && 'opacity-60',
          isUrgent && 'ring-2 ring-orange-200 bg-orange-50',
          isOverdue && 'ring-2 ring-red-200 bg-red-50',
          className
        )}
      >
        <div className={cn('flex-shrink-0 w-2 h-2 rounded-full', impactConfig.dot)} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm truncate">{suggestion.title}</span>
            <Badge variant="secondary" className={cn('text-xs', impactConfig.badge)}>
              +{suggestion.estimated_points}
            </Badge>
          </div>

          {timeUntilDeadline !== null && (
            <div className={cn(
              'text-xs flex items-center gap-1 mt-1',
              isOverdue ? 'text-red-600' : isUrgent ? 'text-orange-600' : 'text-muted-foreground'
            )}>
              <Clock className="w-3 h-3" />
              {isOverdue ? `${Math.abs(timeUntilDeadline)} days overdue` :
               isUrgent ? `${timeUntilDeadline} days left` :
               `${timeUntilDeadline} days`}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1">
          {suggestion.completed ? (
            <CheckCircle2 className="w-5 h-5 text-green-600" />
          ) : suggestion.in_progress ? (
            <div className="w-5 h-5 relative">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                className="w-5 h-5 border-2 border-blue-200 border-t-blue-600 rounded-full"
              />
            </div>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              onClick={handleAction}
              disabled={isProcessing}
              className="h-8 w-8 p-0"
            >
              <ArrowRight className="w-4 h-4" />
            </Button>
          )}
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className={className}
    >
      <Card className={cn(
        'transition-all hover:shadow-md',
        suggestion.completed && 'opacity-75',
        isUrgent && 'ring-2 ring-orange-200',
        isOverdue && 'ring-2 ring-red-200'
      )}>
        <CardHeader className={cn(
          'pb-3',
          suggestion.is_required && 'border-l-4 border-l-red-400'
        )}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <categoryConfig.icon className={cn('w-4 h-4', categoryConfig.color)} />
                <Badge variant="outline" className="text-xs">
                  {suggestion.category}
                </Badge>
                {suggestion.is_required && (
                  <Badge variant="destructive" className="text-xs">
                    Required
                  </Badge>
                )}
              </div>

              <CardTitle className="text-lg leading-tight">
                {suggestion.title}
              </CardTitle>
            </div>

            <div className="flex items-center gap-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge className={cn('text-sm font-semibold', impactConfig.badge)}>
                      +{suggestion.estimated_points}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Trust score points</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              {!suggestion.completed && onDismiss && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleDismiss}
                  disabled={isProcessing}
                  className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>

          <CardDescription className="text-sm leading-relaxed">
            {suggestion.description}
          </CardDescription>

          {/* Deadline and urgency indicators */}
          {timeUntilDeadline !== null && (
            <div className={cn(
              'flex items-center gap-2 text-sm mt-2',
              isOverdue ? 'text-red-600' : isUrgent ? 'text-orange-600' : 'text-muted-foreground'
            )}>
              <Clock className="w-4 h-4" />
              {isOverdue ? (
                <span className="font-medium">
                  {Math.abs(timeUntilDeadline)} days overdue
                </span>
              ) : (
                <span>
                  {isUrgent ? 'Due in ' : ''}{timeUntilDeadline} days
                  {isUrgent && ' (urgent)'}
                </span>
              )}
            </div>
          )}

          {/* Progress indicator */}
          {showProgress && suggestion.in_progress && (
            <div className="mt-3 space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">In progress</span>
                <span className="text-blue-600">Working on it...</span>
              </div>
              <Progress value={65} className="h-1" />
            </div>
          )}
        </CardHeader>

        {/* Expanded details */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
            >
              <CardContent className="pt-0">
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Info className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">
                      Impact level: <span className={impactConfig.textColor}>
                        {suggestion.impact}
                      </span>
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-sm">
                    <TrendingUp className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">
                      Expected improvement: <span className="font-medium text-green-600">
                        +{suggestion.estimated_points} trust points
                      </span>
                    </span>
                  </div>

                  {suggestion.category && (
                    <div className="flex items-center gap-2 text-sm">
                      <categoryConfig.icon className="w-4 h-4 text-muted-foreground" />
                      <span className="text-muted-foreground">
                        Category: <span className="font-medium">
                          {categoryConfig.label}
                        </span>
                      </span>
                    </div>
                  )}
                </div>
              </CardContent>
            </motion.div>
          )}
        </AnimatePresence>

        <CardFooter className="pt-3">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              {suggestion.completed ? (
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle2 className="w-4 h-4" />
                  <span className="text-sm font-medium">Completed</span>
                </div>
              ) : suggestion.in_progress ? (
                <div className="flex items-center gap-2 text-blue-600">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                    className="w-4 h-4 border-2 border-blue-200 border-t-blue-600 rounded-full"
                  />
                  <span className="text-sm font-medium">In Progress</span>
                </div>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="text-muted-foreground"
                >
                  <Info className="w-4 h-4 mr-1" />
                  {isExpanded ? 'Less info' : 'More info'}
                </Button>
              )}
            </div>

            <div className="flex items-center gap-2">
              {!suggestion.completed && onMarkComplete && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleMarkComplete}
                  disabled={isProcessing}
                >
                  <CheckCircle2 className="w-4 h-4 mr-1" />
                  Mark Done
                </Button>
              )}

              {!suggestion.completed && (
                <Button
                  onClick={handleAction}
                  disabled={isProcessing}
                  size="sm"
                  className={cn(
                    suggestion.is_required ? 'bg-red-600 hover:bg-red-700' : '',
                    isUrgent && !suggestion.is_required ? 'bg-orange-600 hover:bg-orange-700' : ''
                  )}
                >
                  {isProcessing ? (
                    <>
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                        className="w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2"
                      />
                      Working...
                    </>
                  ) : (
                    <>
                      {suggestion.action_url && <ExternalLink className="w-4 h-4 mr-1" />}
                      {suggestion.is_required ? 'Complete Now' :
                       isUrgent ? 'Do Soon' : 'Get Started'}
                      <ArrowRight className="w-4 h-4 ml-1" />
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </CardFooter>
      </Card>
    </motion.div>
  );
};

// Multiple suggestion cards component
export const ImprovementSuggestionList: React.FC<{
  suggestions: ImprovementSuggestion[];
  onAction?: (suggestion: ImprovementSuggestion) => void;
  onDismiss?: (suggestion: ImprovementSuggestion) => void;
  onMarkComplete?: (suggestion: ImprovementSuggestion) => void;
  groupBy?: 'impact' | 'category' | 'none';
  compact?: boolean;
  showProgress?: boolean;
  maxItems?: number;
  className?: string;
}> = ({
  suggestions,
  onAction,
  onDismiss,
  onMarkComplete,
  groupBy = 'none',
  compact = false,
  showProgress = false,
  maxItems,
  className,
}) => {
  const displaySuggestions = maxItems ? suggestions.slice(0, maxItems) : suggestions;

  if (groupBy === 'none') {
    return (
      <div className={cn('space-y-4', className)}>
        <AnimatePresence>
          {displaySuggestions.map((suggestion, index) => (
            <ImprovementSuggestionCard
              key={`${suggestion.category}-${index}`}
              suggestion={suggestion}
              onAction={onAction}
              onDismiss={onDismiss}
              onMarkComplete={onMarkComplete}
              compact={compact}
              showProgress={showProgress}
            />
          ))}
        </AnimatePresence>
      </div>
    );
  }

  const grouped = groupSuggestions(displaySuggestions, groupBy);

  return (
    <div className={cn('space-y-6', className)}>
      {Object.entries(grouped).map(([group, items]) => (
        <div key={group} className="space-y-3">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-lg capitalize">{group} Priority</h3>
            <Badge variant="outline">{items.length}</Badge>
          </div>
          <div className="space-y-3">
            <AnimatePresence>
              {items.map((suggestion, index) => (
                <ImprovementSuggestionCard
                  key={`${suggestion.category}-${index}`}
                  suggestion={suggestion}
                  onAction={onAction}
                  onDismiss={onDismiss}
                  onMarkComplete={onMarkComplete}
                  compact={compact}
                  showProgress={showProgress}
                />
              ))}
            </AnimatePresence>
          </div>
        </div>
      ))}
    </div>
  );
};

// Utility functions
const getImpactConfig = (impact: string) => {
  const configs = {
    critical: {
      badge: 'bg-red-100 text-red-800 border-red-200',
      dot: 'bg-red-500',
      textColor: 'text-red-600',
    },
    high: {
      badge: 'bg-orange-100 text-orange-800 border-orange-200',
      dot: 'bg-orange-500',
      textColor: 'text-orange-600',
    },
    medium: {
      badge: 'bg-blue-100 text-blue-800 border-blue-200',
      dot: 'bg-blue-500',
      textColor: 'text-blue-600',
    },
    low: {
      badge: 'bg-gray-100 text-gray-800 border-gray-200',
      dot: 'bg-gray-500',
      textColor: 'text-gray-600',
    },
  };

  return configs[impact as keyof typeof configs] || configs.medium;
};

const getCategoryConfig = (category: string) => {
  const configs = {
    profile: {
      icon: Star,
      label: 'Profile Enhancement',
      color: 'text-blue-600',
    },
    verification: {
      icon: CheckCircle2,
      label: 'Identity Verification',
      color: 'text-green-600',
    },
    trust: {
      icon: TrendingUp,
      label: 'Trust Building',
      color: 'text-purple-600',
    },
    professional: {
      icon: ArrowUp,
      label: 'Professional Growth',
      color: 'text-orange-600',
    },
    activity: {
      icon: AlertCircle,
      label: 'Platform Activity',
      color: 'text-red-600',
    },
  };

  return configs[category as keyof typeof configs] || configs.profile;
};

const groupSuggestions = (suggestions: ImprovementSuggestion[], groupBy: 'impact' | 'category') => {
  return suggestions.reduce((groups, suggestion) => {
    const key = suggestion[groupBy];
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(suggestion);
    return groups;
  }, {} as Record<string, ImprovementSuggestion[]>);
};

export default ImprovementSuggestionCard;