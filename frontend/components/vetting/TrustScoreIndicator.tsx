/**
 * Trust Score Indicator Component
 *
 * Displays trust scores with visual indicators, tooltips, and trend information.
 * Supports various sizes and contexts (profile, dashboard, inline).
 */

'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { TrendingUp, TrendingDown, Minus, Info, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TrustScoreIndicatorProps {
  score: number;
  maxScore?: number;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'minimal' | 'detailed' | 'card';
  showTrend?: boolean;
  trendData?: {
    direction: 'up' | 'down' | 'stable';
    change: number;
    period: string;
  };
  breakdown?: {
    email_domain_score: number;
    github_activity_score: number;
    linkedin_completeness_score: number;
    portfolio_quality_score: number;
    platform_tenure_score: number;
    engagement_score: number;
  };
  interactive?: boolean;
  className?: string;
}

const TrustScoreIndicator: React.FC<TrustScoreIndicatorProps> = ({
  score,
  maxScore = 100,
  size = 'md',
  variant = 'minimal',
  showTrend = false,
  trendData,
  breakdown,
  interactive = true,
  className,
}) => {
  const [showDetails, setShowDetails] = useState(false);

  // Calculate score level and styling
  const percentage = Math.round((score / maxScore) * 100);
  const scoreLevel = getScoreLevel(score);
  const scoreColor = getScoreColor(scoreLevel);

  const sizes = {
    sm: { container: 'w-16 h-16', text: 'text-xs', subtext: 'text-[10px]' },
    md: { container: 'w-20 h-20', text: 'text-sm', subtext: 'text-xs' },
    lg: { container: 'w-24 h-24', text: 'text-base', subtext: 'text-sm' },
    xl: { container: 'w-32 h-32', text: 'text-lg', subtext: 'text-base' },
  };

  if (variant === 'minimal') {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger >
            <div
              className={cn(
                'relative inline-flex items-center justify-center rounded-full border-2 cursor-pointer transition-all hover:scale-105',
                sizes[size].container,
                scoreColor.border,
                scoreColor.bg,
                className
              )}
            >
              <div className="text-center">
                <div className={cn('font-bold', scoreColor.text, sizes[size].text)}>
                  {score}
                </div>
                <div className={cn('text-muted-foreground', sizes[size].subtext)}>
                  /{maxScore}
                </div>
              </div>

              {showTrend && trendData && (
                <div className="absolute -top-1 -right-1">
                  <TrendIndicator trend={trendData} size="sm" />
                </div>
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <div className="text-center">
              <p className="font-semibold">Trust Score: {score}/{maxScore}</p>
              <p className="text-sm text-muted-foreground">
                {getScoreDescription(scoreLevel)}
              </p>
              {showTrend && trendData && (
                <p className="text-xs mt-1">
                  {getTrendText(trendData)}
                </p>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  if (variant === 'detailed') {
    return (
      <div className={cn('space-y-3', className)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className={cn('w-5 h-5', scoreColor.text)} />
            <span className="font-semibold">Trust Score</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={cn('text-2xl font-bold', scoreColor.text)}>
              {score}
            </span>
            <span className="text-muted-foreground">/ {maxScore}</span>
            {showTrend && trendData && (
              <TrendIndicator trend={trendData} />
            )}
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>{scoreLevel.charAt(0).toUpperCase() + scoreLevel.slice(1)} Quality</span>
            <span>{percentage}%</span>
          </div>
          <Progress
            value={percentage}
            className="h-2"
            indicatorClassName={scoreColor.progress}
          />
        </div>

        {breakdown && interactive && (
          <div className="space-y-2">
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <Info className="w-4 h-4" />
              {showDetails ? 'Hide' : 'Show'} breakdown
            </button>

            <AnimatePresence>
              {showDetails && (
                <TrustScoreBreakdown breakdown={breakdown} />
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    );
  }

  if (variant === 'card') {
    return (
      <Card className={cn('cursor-pointer transition-all hover:shadow-md', className)}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Shield className={cn('w-5 h-5', scoreColor.text)} />
              <span className="font-semibold">Trust Score</span>
            </div>
            <Badge variant={scoreLevel as any} className={scoreColor.badge}>
              {scoreLevel.toUpperCase()}
            </Badge>
          </div>

          <div className="text-center mb-4">
            <div className={cn('text-4xl font-bold mb-1', scoreColor.text)}>
              {score}
            </div>
            <div className="text-muted-foreground">
              out of {maxScore}
            </div>
          </div>

          <Progress
            value={percentage}
            className="mb-3 h-2"
            indicatorClassName={scoreColor.progress}
          />

          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">
              {getScoreDescription(scoreLevel)}
            </span>
            {showTrend && trendData && (
              <TrendIndicator trend={trendData} />
            )}
          </div>
        </CardContent>
      </Card>
    );
  }
};

// Trend Indicator Component
const TrendIndicator: React.FC<{
  trend: {
    direction: 'up' | 'down' | 'stable';
    change: number;
    period: string;
  };
  size?: 'sm' | 'md';
}> = ({ trend, size = 'md' }) => {
  const iconSize = size === 'sm' ? 'w-3 h-3' : 'w-4 h-4';
  const textSize = size === 'sm' ? 'text-xs' : 'text-sm';

  const trendConfig = {
    up: {
      icon: TrendingUp,
      color: 'text-green-600',
      bg: 'bg-green-50',
      text: `+${trend.change}`,
    },
    down: {
      icon: TrendingDown,
      color: 'text-red-600',
      bg: 'bg-red-50',
      text: `-${Math.abs(trend.change)}`,
    },
    stable: {
      icon: Minus,
      color: 'text-gray-600',
      bg: 'bg-gray-50',
      text: '0',
    },
  };

  const config = trendConfig[trend.direction];
  const Icon = config.icon;

  return (
    <div className={cn(
      'inline-flex items-center gap-1 px-2 py-1 rounded-full',
      config.bg,
      size === 'sm' ? 'px-1.5 py-0.5' : 'px-2 py-1'
    )}>
      <Icon className={cn(iconSize, config.color)} />
      <span className={cn(textSize, 'font-medium', config.color)}>
        {config.text}
      </span>
    </div>
  );
};

// Trust Score Breakdown Component
const TrustScoreBreakdown: React.FC<{
  breakdown: {
    email_domain_score: number;
    github_activity_score: number;
    linkedin_completeness_score: number;
    portfolio_quality_score: number;
    platform_tenure_score: number;
    engagement_score: number;
  };
}> = ({ breakdown }) => {
  const factors = [
    { key: 'email_domain_score', label: 'Email Domain', max: 100 },
    { key: 'github_activity_score', label: 'GitHub Activity', max: 100 },
    { key: 'linkedin_completeness_score', label: 'LinkedIn Profile', max: 100 },
    { key: 'portfolio_quality_score', label: 'Portfolio Quality', max: 100 },
    { key: 'platform_tenure_score', label: 'Platform Tenure', max: 100 },
    { key: 'engagement_score', label: 'Engagement', max: 100 },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.2 }}
      className="space-y-3 overflow-hidden"
    >
      {factors.map(({ key, label, max }) => {
        const score = breakdown[key as keyof typeof breakdown];
        const percentage = (score / max) * 100;

        return (
          <div key={key} className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{label}</span>
              <span className="font-medium">{score}/{max}</span>
            </div>
            <Progress
              value={percentage}
              className="h-1"
              indicatorClassName={getScoreColor(getScoreLevel(score)).progress}
            />
          </div>
        );
      })}
    </motion.div>
  );
};

// Utility functions
const getScoreLevel = (score: number): string => {
  if (score >= 80) return 'excellent';
  if (score >= 60) return 'good';
  if (score >= 40) return 'moderate';
  if (score >= 20) return 'low';
  return 'critical';
};

const getScoreColor = (level: string) => {
  const colors = {
    excellent: {
      text: 'text-green-700',
      bg: 'bg-green-50',
      border: 'border-green-200',
      progress: 'bg-green-600',
      badge: 'bg-green-100 text-green-800',
    },
    good: {
      text: 'text-blue-700',
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      progress: 'bg-blue-600',
      badge: 'bg-blue-100 text-blue-800',
    },
    moderate: {
      text: 'text-yellow-700',
      bg: 'bg-yellow-50',
      border: 'border-yellow-200',
      progress: 'bg-yellow-600',
      badge: 'bg-yellow-100 text-yellow-800',
    },
    low: {
      text: 'text-orange-700',
      bg: 'bg-orange-50',
      border: 'border-orange-200',
      progress: 'bg-orange-600',
      badge: 'bg-orange-100 text-orange-800',
    },
    critical: {
      text: 'text-red-700',
      bg: 'bg-red-50',
      border: 'border-red-200',
      progress: 'bg-red-600',
      badge: 'bg-red-100 text-red-800',
    },
  };

  return colors[level as keyof typeof colors] || colors.moderate;
};

const getScoreDescription = (level: string): string => {
  const descriptions = {
    excellent: 'Highly trusted profile',
    good: 'Well-established profile',
    moderate: 'Developing credibility',
    low: 'Needs improvement',
    critical: 'Requires attention',
  };

  return descriptions[level as keyof typeof descriptions] || 'Unknown status';
};

const getTrendText = (trend: { direction: string; change: number; period: string }): string => {
  const direction = trend.direction === 'up' ? 'increased' :
                   trend.direction === 'down' ? 'decreased' : 'remained stable';
  return `${direction} by ${Math.abs(trend.change)} points in the last ${trend.period}`;
};

export default TrustScoreIndicator;