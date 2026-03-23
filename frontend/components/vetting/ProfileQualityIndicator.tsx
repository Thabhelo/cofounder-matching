/**
 * Profile Quality Indicator Component
 *
 * Compact trust and quality indicators for embedding in user profiles,
 * match cards, and other contexts where space is limited but quality
 * information is essential.
 */

'use client';

import React from 'react';
import { motion } from 'framer-motion';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Star,
  TrendingUp,
  TrendingDown,
  Verified,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface QualityMetrics {
  trust_score: number;
  profile_completeness: number;
  verification_badges: {
    email: boolean;
    domain: boolean;
    github: boolean;
    linkedin: boolean;
    manual: boolean;
  };
  activity_score?: number;
  response_rate?: number;
  account_age_days?: number;
  last_active?: Date;
  report_count?: number;
}

interface ProfileQualityIndicatorProps {
  metrics: QualityMetrics;
  variant?: 'minimal' | 'compact' | 'detailed' | 'badge-only';
  showTrustScore?: boolean;
  showVerifications?: boolean;
  showActivity?: boolean;
  interactive?: boolean;
  className?: string;
}

const ProfileQualityIndicator: React.FC<ProfileQualityIndicatorProps> = ({
  metrics,
  variant = 'compact',
  showTrustScore = true,
  showVerifications = true,
  showActivity = false,
  interactive = true,
  className,
}) => {
  const trustLevel = getTrustLevel(metrics.trust_score);
  const qualityLevel = getQualityLevel(metrics);
  const verificationCount = Object.values(metrics.verification_badges).filter(Boolean).length;
  const isHighQuality = metrics.trust_score >= 70 && metrics.profile_completeness >= 80;
  const hasRedFlags = (metrics.report_count || 0) > 0;

  if (variant === 'minimal') {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={cn('inline-flex items-center gap-1', className)}>
              <QualityShield
                level={qualityLevel}
                size="sm"
                hasRedFlags={hasRedFlags}
              />
              {showTrustScore && (
                <span className={cn(
                  'text-xs font-medium',
                  trustLevel.textColor
                )}>
                  {metrics.trust_score}
                </span>
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <QualityTooltipContent metrics={metrics} />
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  if (variant === 'badge-only') {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge
              variant={qualityLevel.badgeVariant as any}
              className={cn('text-xs', qualityLevel.badgeStyle, className)}
            >
              <QualityShield
                level={qualityLevel}
                size="xs"
                className="mr-1"
                hasRedFlags={hasRedFlags}
              />
              {trustLevel.label}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <QualityTooltipContent metrics={metrics} />
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  if (variant === 'compact') {
    return (
      <div className={cn(
        'inline-flex items-center gap-2 px-3 py-2 rounded-lg border',
        qualityLevel.bgColor,
        qualityLevel.borderColor,
        interactive && 'cursor-pointer hover:shadow-sm transition-shadow',
        className
      )}>
        <QualityShield
          level={qualityLevel}
          size="sm"
          hasRedFlags={hasRedFlags}
        />

        <div className="flex items-center gap-2 min-w-0">
          {showTrustScore && (
            <div className="flex items-center gap-1">
              <span className={cn('text-sm font-semibold', trustLevel.textColor)}>
                {metrics.trust_score}
              </span>
              <span className="text-xs text-muted-foreground">/100</span>
            </div>
          )}

          {showVerifications && verificationCount > 0 && (
            <div className="flex items-center gap-1">
              <Verified className="w-3 h-3 text-blue-600" />
              <span className="text-xs text-muted-foreground">
                {verificationCount}
              </span>
            </div>
          )}

          {showActivity && metrics.activity_score && (
            <div className="flex items-center gap-1">
              <TrendingUp className="w-3 h-3 text-green-600" />
              <span className="text-xs text-muted-foreground">
                {metrics.activity_score}%
              </span>
            </div>
          )}

          {hasRedFlags && (
            <AlertTriangle className="w-3 h-3 text-red-500" />
          )}
        </div>
      </div>
    );
  }

  if (variant === 'detailed') {
    return (
      <div className={cn(
        'p-4 rounded-lg border space-y-3',
        qualityLevel.bgColor,
        qualityLevel.borderColor,
        className
      )}>
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <QualityShield
              level={qualityLevel}
              size="md"
              hasRedFlags={hasRedFlags}
            />
            <div>
              <div className="font-semibold text-sm">
                {trustLevel.label} Quality
              </div>
              <div className="text-xs text-muted-foreground">
                Trust Score: {metrics.trust_score}/100
              </div>
            </div>
          </div>

          {isHighQuality && (
            <Badge variant="secondary" className="bg-green-100 text-green-800">
              <Star className="w-3 h-3 mr-1" />
              High Quality
            </Badge>
          )}
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="space-y-1">
            <div className="text-muted-foreground">Profile</div>
            <div className="font-medium">
              {metrics.profile_completeness}% complete
            </div>
          </div>

          <div className="space-y-1">
            <div className="text-muted-foreground">Verified</div>
            <div className="font-medium">
              {verificationCount}/5 badges
            </div>
          </div>

          {metrics.activity_score && (
            <div className="space-y-1">
              <div className="text-muted-foreground">Activity</div>
              <div className="font-medium">
                {metrics.activity_score}% active
              </div>
            </div>
          )}

          {metrics.response_rate && (
            <div className="space-y-1">
              <div className="text-muted-foreground">Response</div>
              <div className="font-medium">
                {Math.round(metrics.response_rate * 100)}% rate
              </div>
            </div>
          )}
        </div>

        {/* Verification Badges */}
        {showVerifications && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Verified:</span>
            <div className="flex gap-1">
              {Object.entries(metrics.verification_badges).map(([type, verified]) => (
                <VerificationMini key={type} type={type} verified={verified} />
              ))}
            </div>
          </div>
        )}

        {/* Warnings */}
        {hasRedFlags && (
          <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 px-2 py-1 rounded">
            <AlertCircle className="w-3 h-3" />
            <span>Has {metrics.report_count} report(s)</span>
          </div>
        )}
      </div>
    );
  }

  return null;
};

// Quality Shield Component
const QualityShield: React.FC<{
  level: ReturnType<typeof getQualityLevel>;
  size?: 'xs' | 'sm' | 'md';
  hasRedFlags?: boolean;
  className?: string;
}> = ({ level, size = 'sm', hasRedFlags, className }) => {
  const sizeClasses = {
    xs: 'w-3 h-3',
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
  };

  const ShieldIcon = hasRedFlags ? ShieldAlert : level.icon;

  return (
    <ShieldIcon
      className={cn(
        sizeClasses[size],
        hasRedFlags ? 'text-red-500' : level.iconColor,
        className
      )}
    />
  );
};

// Mini Verification Badge
const VerificationMini: React.FC<{
  type: string;
  verified: boolean;
}> = ({ type, verified }) => {
  const config = {
    email: { label: '@', color: verified ? 'text-blue-600' : 'text-gray-300' },
    domain: { label: '🏢', color: verified ? 'text-purple-600' : 'text-gray-300' },
    github: { label: '⚡', color: verified ? 'text-gray-800' : 'text-gray-300' },
    linkedin: { label: '💼', color: verified ? 'text-blue-700' : 'text-gray-300' },
    manual: { label: '✓', color: verified ? 'text-green-600' : 'text-gray-300' },
  };

  const badgeConfig = config[type as keyof typeof config] || config.email;

  return (
    <div className={cn(
      'w-5 h-5 rounded-full border flex items-center justify-center text-xs font-bold',
      verified
        ? 'bg-white border-gray-200'
        : 'bg-gray-50 border-gray-200',
      badgeConfig.color
    )}>
      {badgeConfig.label}
    </div>
  );
};

// Tooltip Content
const QualityTooltipContent: React.FC<{
  metrics: QualityMetrics;
}> = ({ metrics }) => {
  const verificationCount = Object.values(metrics.verification_badges).filter(Boolean).length;
  const trustLevel = getTrustLevel(metrics.trust_score);
  const hasRedFlags = (metrics.report_count || 0) > 0;

  return (
    <div className="max-w-xs space-y-2">
      <div className="font-semibold">{trustLevel.label} Quality Profile</div>

      <div className="text-sm space-y-1">
        <div>Trust Score: <span className="font-medium">{metrics.trust_score}/100</span></div>
        <div>Profile: <span className="font-medium">{metrics.profile_completeness}% complete</span></div>
        <div>Verified: <span className="font-medium">{verificationCount}/5 badges</span></div>

        {metrics.activity_score && (
          <div>Activity: <span className="font-medium">{metrics.activity_score}%</span></div>
        )}

        {metrics.response_rate && (
          <div>Response Rate: <span className="font-medium">{Math.round(metrics.response_rate * 100)}%</span></div>
        )}

        {metrics.account_age_days && (
          <div>Account Age: <span className="font-medium">{Math.floor(metrics.account_age_days / 30)} months</span></div>
        )}
      </div>

      {hasRedFlags && (
        <div className="text-xs text-red-600 border-t border-gray-200 pt-2">
          ⚠️ Has {metrics.report_count} report(s)
        </div>
      )}

      <div className="text-xs text-muted-foreground border-t border-gray-200 pt-2">
        {trustLevel.description}
      </div>
    </div>
  );
};

// Quality Level for Match Cards
export const MatchQualityIndicator: React.FC<{
  metrics: QualityMetrics;
  showCompatibility?: boolean;
  compatibilityScore?: number;
  className?: string;
}> = ({
  metrics,
  showCompatibility = false,
  compatibilityScore,
  className
}) => {
  const trustLevel = getTrustLevel(metrics.trust_score);
  const verificationCount = Object.values(metrics.verification_badges).filter(Boolean).length;
  const hasRedFlags = (metrics.report_count || 0) > 0;

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <ProfileQualityIndicator
        metrics={metrics}
        variant="minimal"
        interactive={true}
      />

      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <span>{metrics.trust_score}</span>
        {verificationCount > 0 && (
          <>
            <span>•</span>
            <Verified className="w-3 h-3 text-blue-600" />
            <span>{verificationCount}</span>
          </>
        )}
        {hasRedFlags && (
          <>
            <span>•</span>
            <AlertTriangle className="w-3 h-3 text-red-500" />
          </>
        )}
      </div>

      {showCompatibility && compatibilityScore && (
        <Badge variant="secondary" className="ml-auto text-xs">
          {compatibilityScore}% match
        </Badge>
      )}
    </div>
  );
};

// Bulk Quality Overview
export const BulkQualityOverview: React.FC<{
  userMetrics: QualityMetrics[];
  showAverages?: boolean;
  className?: string;
}> = ({ userMetrics, showAverages = true, className }) => {
  const averageTrust = userMetrics.reduce((sum, m) => sum + m.trust_score, 0) / userMetrics.length;
  const averageCompleteness = userMetrics.reduce((sum, m) => sum + m.profile_completeness, 0) / userMetrics.length;
  const highQualityCount = userMetrics.filter(m => m.trust_score >= 70).length;
  const verifiedCount = userMetrics.filter(m => Object.values(m.verification_badges).some(Boolean)).length;

  return (
    <div className={cn('grid grid-cols-2 md:grid-cols-4 gap-4', className)}>
      {showAverages && (
        <>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">
              {Math.round(averageTrust)}
            </div>
            <div className="text-sm text-muted-foreground">Avg Trust</div>
          </div>

          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              {Math.round(averageCompleteness)}%
            </div>
            <div className="text-sm text-muted-foreground">Avg Complete</div>
          </div>
        </>
      )}

      <div className="text-center">
        <div className="text-2xl font-bold text-purple-600">
          {highQualityCount}
        </div>
        <div className="text-sm text-muted-foreground">High Quality</div>
      </div>

      <div className="text-center">
        <div className="text-2xl font-bold text-orange-600">
          {verifiedCount}
        </div>
        <div className="text-sm text-muted-foreground">Verified</div>
      </div>
    </div>
  );
};

// Utility Functions
const getTrustLevel = (score: number) => {
  if (score >= 80) return {
    label: 'Excellent',
    textColor: 'text-green-700',
    description: 'Highly trusted with strong verification'
  };
  if (score >= 60) return {
    label: 'Good',
    textColor: 'text-blue-700',
    description: 'Well-established with good credibility'
  };
  if (score >= 40) return {
    label: 'Fair',
    textColor: 'text-yellow-700',
    description: 'Developing trust, some improvements needed'
  };
  if (score >= 20) return {
    label: 'Poor',
    textColor: 'text-orange-700',
    description: 'Low trust score, significant improvements needed'
  };
  return {
    label: 'Critical',
    textColor: 'text-red-700',
    description: 'Very low trust score, requires immediate attention'
  };
};

const getQualityLevel = (metrics: QualityMetrics) => {
  const trustLevel = getTrustLevel(metrics.trust_score);
  const verificationCount = Object.values(metrics.verification_badges).filter(Boolean).length;
  const isWellRounded = metrics.trust_score >= 50 && metrics.profile_completeness >= 60 && verificationCount >= 2;

  if (metrics.trust_score >= 80 && isWellRounded) {
    return {
      icon: ShieldCheck,
      iconColor: 'text-green-600',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200',
      badgeVariant: 'secondary',
      badgeStyle: 'bg-green-100 text-green-800',
      label: 'Excellent'
    };
  }

  if (metrics.trust_score >= 60 && isWellRounded) {
    return {
      icon: Shield,
      iconColor: 'text-blue-600',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
      badgeVariant: 'secondary',
      badgeStyle: 'bg-blue-100 text-blue-800',
      label: 'Good'
    };
  }

  if (metrics.trust_score >= 40) {
    return {
      icon: Shield,
      iconColor: 'text-yellow-600',
      bgColor: 'bg-yellow-50',
      borderColor: 'border-yellow-200',
      badgeVariant: 'outline',
      badgeStyle: 'bg-yellow-100 text-yellow-800',
      label: 'Fair'
    };
  }

  if (metrics.trust_score >= 20) {
    return {
      icon: ShieldAlert,
      iconColor: 'text-orange-600',
      bgColor: 'bg-orange-50',
      borderColor: 'border-orange-200',
      badgeVariant: 'outline',
      badgeStyle: 'bg-orange-100 text-orange-800',
      label: 'Poor'
    };
  }

  return {
    icon: ShieldX,
    iconColor: 'text-red-600',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    badgeVariant: 'destructive',
    badgeStyle: 'bg-red-100 text-red-800',
    label: 'Critical'
  };
};

export default ProfileQualityIndicator;