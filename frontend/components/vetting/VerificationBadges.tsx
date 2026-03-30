/**
 * Verification Badges Component
 *
 * Displays verification status badges with interactive elements for starting
 * verification processes. Supports various layouts and contexts.
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
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Mail,
  Github,
  Linkedin,
  Building2,
  Shield,
  Check,
  X,
  Clock,
  AlertCircle,
  Plus,
  ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface VerificationBadge {
  type: 'email' | 'domain' | 'github' | 'linkedin' | 'manual';
  verified: boolean;
  status?: 'pending' | 'verified' | 'failed' | 'expired';
  verifiedAt?: Date;
  expiresAt?: Date;
  failureReason?: string;
}

interface VerificationBadgesProps {
  badges: Record<string, boolean> | VerificationBadge[];
  layout?: 'horizontal' | 'vertical' | 'grid' | 'compact';
  size?: 'sm' | 'md' | 'lg';
  interactive?: boolean;
  showLabels?: boolean;
  showProgress?: boolean;
  onVerify?: (type: string) => void;
  onRetry?: (type: string) => void;
  className?: string;
}

const VerificationBadges: React.FC<VerificationBadgesProps> = ({
  badges,
  layout = 'horizontal',
  size = 'md',
  interactive = true,
  showLabels = true,
  showProgress = false,
  onVerify,
  onRetry,
  className,
}) => {
  const [hoveredBadge, setHoveredBadge] = useState<string | null>(null);

  // Normalize badges to array format
  const badgeArray = normalizeBadges(badges);

  // Calculate verification progress
  const verifiedCount = badgeArray.filter(badge => badge.verified).length;
  const totalCount = badgeArray.length;
  const progressPercentage = (verifiedCount / totalCount) * 100;

  const layoutClasses = {
    horizontal: 'flex flex-wrap gap-2 items-center',
    vertical: 'flex flex-col gap-2',
    grid: 'grid grid-cols-2 md:grid-cols-3 gap-2',
    compact: 'flex gap-1',
  };

  return (
    <div className={cn('verification-badges', className)}>
      {showProgress && (
        <VerificationProgress
          completed={verifiedCount}
          total={totalCount}
          percentage={progressPercentage}
        />
      )}

      <div className={layoutClasses[layout]}>
        {badgeArray.map((badge) => (
          <VerificationBadgeItem
            key={badge.type}
            badge={badge}
            size={size}
            showLabel={showLabels && layout !== 'compact'}
            interactive={interactive}
            onVerify={onVerify}
            onRetry={onRetry}
            onHover={setHoveredBadge}
            isHovered={hoveredBadge === badge.type}
          />
        ))}
      </div>

      {interactive && layout !== 'compact' && (
        <div className="mt-4 text-sm text-muted-foreground">
          <p>
            {verifiedCount} of {totalCount} verifications completed
            {verifiedCount < totalCount && ' - complete more to increase your trust score'}
          </p>
        </div>
      )}
    </div>
  );
};

// Individual Badge Component
const VerificationBadgeItem: React.FC<{
  badge: VerificationBadge;
  size: 'sm' | 'md' | 'lg';
  showLabel: boolean;
  interactive: boolean;
  onVerify?: (type: string) => void;
  onRetry?: (type: string) => void;
  onHover: (type: string | null) => void;
  isHovered: boolean;
}> = ({
  badge,
  size,
  showLabel,
  interactive,
  onVerify,
  onRetry,
  onHover,
  isHovered,
}) => {
  const config = getBadgeConfig(badge.type);
  const statusConfig = getStatusConfig(badge.status || (badge.verified ? 'verified' : 'unverified'));

  const sizes = {
    sm: { icon: 'w-4 h-4', container: 'p-2', text: 'text-xs' },
    md: { icon: 'w-5 h-5', container: 'p-3', text: 'text-sm' },
    lg: { icon: 'w-6 h-6', container: 'p-4', text: 'text-base' },
  };

  const handleClick = () => {
    if (!interactive) return;

    if (badge.status === 'failed' && onRetry) {
      onRetry(badge.type);
    } else if (!badge.verified && onVerify) {
      onVerify(badge.type);
    }
  };

  const badgeContent = (
    <motion.div
      className={cn(
        'relative inline-flex items-center gap-2 rounded-lg border-2 transition-all cursor-pointer',
        sizes[size].container,
        statusConfig.border,
        statusConfig.bg,
        interactive && 'hover:scale-105 hover:shadow-md',
        isHovered && 'ring-2 ring-blue-200'
      )}
      onClick={handleClick}
      onMouseEnter={() => onHover(badge.type)}
      onMouseLeave={() => onHover(null)}
      whileHover={interactive ? { scale: 1.02 } : {}}
      whileTap={interactive ? { scale: 0.98 } : {}}
    >
      {/* Main Icon */}
      <div className={cn('flex-shrink-0', statusConfig.iconColor)}>
        <config.icon className={sizes[size].icon} />
      </div>

      {/* Status Icon Overlay */}
      <div className="absolute -top-1 -right-1">
        <div className={cn(
          'rounded-full p-0.5',
          statusConfig.statusBg
        )}>
          <statusConfig.statusIcon className={cn(
            'w-3 h-3',
            statusConfig.statusColor
          )} />
        </div>
      </div>

      {/* Label */}
      {showLabel && (
        <div className="flex-1 min-w-0">
          <div className={cn(
            'font-medium truncate',
            sizes[size].text,
            statusConfig.textColor
          )}>
            {config.label}
          </div>
          {badge.status && badge.status !== 'verified' && (
            <div className={cn(
              'text-xs text-muted-foreground truncate'
            )}>
              {statusConfig.statusText}
            </div>
          )}
        </div>
      )}

      {/* Action Button */}
      {interactive && !badge.verified && (
        <Button
          size="sm"
          variant="ghost"
          className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => {
            e.stopPropagation();
            handleClick();
          }}
        >
          <Plus className="w-3 h-3" />
        </Button>
      )}
    </motion.div>
  );

  if (!interactive) {
    return badgeContent;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger >
          {badgeContent}
        </TooltipTrigger>
        <TooltipContent>
          <VerificationTooltipContent badge={badge} config={config} />
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

// Tooltip Content Component
const VerificationTooltipContent: React.FC<{
  badge: VerificationBadge;
  config: ReturnType<typeof getBadgeConfig>;
}> = ({ badge, config }) => {
  const formatDate = (date: Date) => date.toLocaleDateString();

  return (
    <div className="max-w-xs">
      <div className="font-semibold mb-1">{config.label} Verification</div>

      {badge.verified ? (
        <div>
          <p className="text-sm text-green-600 mb-1">✓ Verified</p>
          {badge.verifiedAt && (
            <p className="text-xs text-muted-foreground">
              Verified on {formatDate(badge.verifiedAt)}
            </p>
          )}
          {badge.expiresAt && (
            <p className="text-xs text-muted-foreground">
              Expires {formatDate(badge.expiresAt)}
            </p>
          )}
        </div>
      ) : (
        <div>
          <p className="text-sm mb-1">{config.description}</p>

          {badge.status === 'pending' && (
            <p className="text-xs text-yellow-600">
              Verification in progress...
            </p>
          )}

          {badge.status === 'failed' && (
            <div>
              <p className="text-xs text-red-600 mb-1">
                Verification failed
              </p>
              {badge.failureReason && (
                <p className="text-xs text-muted-foreground">
                  {badge.failureReason}
                </p>
              )}
              <p className="text-xs text-blue-600 mt-1">
                Click to retry
              </p>
            </div>
          )}

          {!badge.status && (
            <p className="text-xs text-blue-600">
              Click to start verification
            </p>
          )}
        </div>
      )}

      <div className="text-xs text-muted-foreground mt-2">
        <strong>Impact:</strong> {config.trustScoreImpact} trust score points
      </div>
    </div>
  );
};

// Verification Progress Component
const VerificationProgress: React.FC<{
  completed: number;
  total: number;
  percentage: number;
}> = ({ completed, total, percentage }) => {
  return (
    <div className="mb-4 space-y-2">
      <div className="flex justify-between items-center">
        <span className="text-sm font-medium">Verification Progress</span>
        <span className="text-sm text-muted-foreground">
          {completed}/{total} completed
        </span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <motion.div
          className="bg-gradient-to-r from-blue-500 to-green-500 h-2 rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      </div>
      <div className="text-xs text-center text-muted-foreground">
        Complete all verifications to maximize your trust score
      </div>
    </div>
  );
};

// Compact Badges Grid Component
export const CompactVerificationBadges: React.FC<{
  badges: Record<string, boolean>;
  size?: 'sm' | 'md';
  className?: string;
}> = ({ badges, size = 'sm', className }) => {
  const badgeArray = normalizeBadges(badges);

  return (
    <div className={cn('flex gap-1', className)}>
      {badgeArray.map((badge) => {
        const config = getBadgeConfig(badge.type);
        const iconSize = size === 'sm' ? 'w-3 h-3' : 'w-4 h-4';

        return (
          <TooltipProvider key={badge.type}>
            <Tooltip>
              <TooltipTrigger >
                <div
                  className={cn(
                    'rounded-full p-1.5 border',
                    badge.verified
                      ? 'bg-green-50 border-green-200 text-green-700'
                      : 'bg-gray-50 border-gray-200 text-gray-400'
                  )}
                >
                  <config.icon className={iconSize} />
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <div className="text-center">
                  <p className="font-medium">{config.label}</p>
                  <p className="text-sm text-muted-foreground">
                    {badge.verified ? 'Verified ✓' : 'Not verified'}
                  </p>
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      })}
    </div>
  );
};

// Utility Functions
const normalizeBadges = (badges: Record<string, boolean> | VerificationBadge[]): VerificationBadge[] => {
  if (Array.isArray(badges)) {
    return badges;
  }

  const badgeTypes = ['email', 'domain', 'github', 'linkedin', 'manual'] as const;
  return badgeTypes.map(type => ({
    type,
    verified: badges[type] || false,
    status: badges[type] ? 'verified' as const : undefined,
  }));
};

const getBadgeConfig = (type: string) => {
  const configs = {
    email: {
      icon: Mail,
      label: 'Email',
      description: 'Verify your email address to enable platform features',
      trustScoreImpact: '+10',
      color: 'blue',
    },
    domain: {
      icon: Building2,
      label: 'Domain',
      description: 'Verify your professional or educational email domain',
      trustScoreImpact: '+15',
      color: 'purple',
    },
    github: {
      icon: Github,
      label: 'GitHub',
      description: 'Connect and verify your GitHub profile to showcase your work',
      trustScoreImpact: '+20',
      color: 'gray',
    },
    linkedin: {
      icon: Linkedin,
      label: 'LinkedIn',
      description: 'Verify your LinkedIn profile to build professional trust',
      trustScoreImpact: '+15',
      color: 'blue',
    },
    manual: {
      icon: Shield,
      label: 'Manual',
      description: 'Manual verification by our team for special cases',
      trustScoreImpact: '+25',
      color: 'green',
    },
  };

  return configs[type as keyof typeof configs] || configs.email;
};

const getStatusConfig = (status: string) => {
  const configs = {
    verified: {
      statusIcon: Check,
      statusColor: 'text-white',
      statusBg: 'bg-green-500',
      statusText: 'Verified',
      border: 'border-green-200',
      bg: 'bg-green-50',
      textColor: 'text-green-800',
      iconColor: 'text-green-600',
    },
    pending: {
      statusIcon: Clock,
      statusColor: 'text-white',
      statusBg: 'bg-yellow-500',
      statusText: 'Pending',
      border: 'border-yellow-200',
      bg: 'bg-yellow-50',
      textColor: 'text-yellow-800',
      iconColor: 'text-yellow-600',
    },
    failed: {
      statusIcon: X,
      statusColor: 'text-white',
      statusBg: 'bg-red-500',
      statusText: 'Failed',
      border: 'border-red-200',
      bg: 'bg-red-50',
      textColor: 'text-red-800',
      iconColor: 'text-red-600',
    },
    expired: {
      statusIcon: AlertCircle,
      statusColor: 'text-white',
      statusBg: 'bg-orange-500',
      statusText: 'Expired',
      border: 'border-orange-200',
      bg: 'bg-orange-50',
      textColor: 'text-orange-800',
      iconColor: 'text-orange-600',
    },
    unverified: {
      statusIcon: Plus,
      statusColor: 'text-gray-500',
      statusBg: 'bg-gray-200',
      statusText: 'Not verified',
      border: 'border-gray-200',
      bg: 'bg-gray-50',
      textColor: 'text-gray-600',
      iconColor: 'text-gray-400',
    },
  };

  return configs[status as keyof typeof configs] || configs.unverified;
};

export default VerificationBadges;