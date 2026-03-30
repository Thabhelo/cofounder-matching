"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@clerk/nextjs"
import { useRouter } from "next/navigation"
import { AppShell } from "@/components/layout/AppShell"
import { api } from "@/lib/api"
import type { ProfileDiscoverItem } from "@/lib/types"
import { safeHref } from "@/lib/utils"

import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog"

import {
  ChevronLeft,
  ChevronRight,
  Star,
  Send,
  SkipForward,
  Github,
  Linkedin,
  Globe,
  MapPin,
  Briefcase,
  Rocket,
  Loader2,
  Users,
  RefreshCw,
} from "lucide-react"
import { PageLoader } from "@/components/ui/loader"

export default function DiscoverPage() {
  const { getToken } = useAuth()
  const router = useRouter()
  const [items, setItems] = useState<ProfileDiscoverItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [skipping, setSkipping] = useState<string | null>(null)
  const [inviting, setInviting] = useState<string | null>(null)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteMessage, setInviteMessage] = useState("")
  const [invitesRemaining, setInvitesRemaining] = useState<number | null>(null)
  const [savedProfiles, setSavedProfiles] = useState<Set<string>>(new Set())

  useEffect(() => {
    async function loadProfiles() {
      try {
        const token = await getToken()
        if (!token) {
          router.push("/")
          return
        }

        const data = await api.profiles.discover({ limit: 20 }, token)
        setItems(data)
      } catch (error) {
        console.error("Failed to load profiles:", error)
      } finally {
        setLoading(false)
      }
    }

    loadProfiles()
  }, [getToken, router])

  const handleSave = async (profileId: string) => {
    try {
      const token = await getToken()
      if (!token) return

      setSaving(profileId)
      await api.profiles.save(profileId, token)

      setSavedProfiles((prev) => new Set(prev).add(profileId))

      setItems((prev) => prev.filter((i) => i.profile.id !== profileId))
      if (currentIndex >= items.length - 1) {
        setCurrentIndex(Math.max(0, currentIndex - 1))
      }
    } catch (error) {
      console.error("Failed to save profile:", error)
      alert("Failed to save profile. Please try again.")
    } finally {
      setSaving(null)
    }
  }

  const handleSkip = async (profileId: string) => {
    try {
      const token = await getToken()
      if (!token) return

      setSkipping(profileId)
      await api.profiles.skip(profileId, token)

      setItems((prev) => prev.filter((i) => i.profile.id !== profileId))
      if (currentIndex >= items.length - 1) {
        setCurrentIndex(Math.max(0, currentIndex - 1))
      }
    } catch (error) {
      console.error("Failed to skip profile:", error)
    } finally {
      setSkipping(null)
    }
  }

  const handleInviteClick = () => {
    setShowInviteModal(true)
    setInviteMessage("")
  }

  const handleSendInvite = async () => {
    if (!currentProfile) return

    try {
      const token = await getToken()
      if (!token) return

      setInviting(currentProfile.id)
      const result = await api.matches.sendInvite(currentProfile.id, inviteMessage ?? "Hi! I'd like to connect.", token)

      setInvitesRemaining(result.invites_remaining)
      setShowInviteModal(false)
      setInviteMessage("")

      setItems((prev) => prev.filter((i) => i.profile.id !== currentProfile.id))
      if (currentIndex >= items.length - 1) {
        setCurrentIndex(Math.max(0, currentIndex - 1))
      }

      if ((result as any).auto_connected) {
        alert(`You're now connected with ${currentProfile.name}! Check your inbox to start chatting. You have ${result.invites_remaining} invites remaining this week.`)
      } else {
        alert(`Invitation sent to ${currentProfile.name}! You have ${result.invites_remaining} invites remaining this week.`)
      }
    } catch (error: any) {
      console.error("Failed to send invite:", error)
      alert(error.message || "Failed to send invitation. Please try again.")
    } finally {
      setInviting(null)
    }
  }

  const currentItem = items[currentIndex]
  const currentProfile = currentItem?.profile

  if (loading) {
    return (
      <AppShell>
        <PageLoader label="Loading profiles..." />
      </AppShell>
    )
  }

  if (items.length === 0) {
    return (
      <AppShell>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-md px-6">
            <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-full bg-muted">
              <Users className="size-8 text-muted-foreground" />
            </div>
            <h2 className="text-2xl font-semibold tracking-tight mb-2">No more profiles to discover</h2>
            <p className="text-muted-foreground mb-8">
              You&apos;ve reviewed all available profiles. Check back later for new founders!
            </p>
            <Button
              onClick={() => window.location.reload()}
              size="lg"
              className="gap-2"
            >
              <RefreshCw className="size-4" />
              Refresh
            </Button>
          </div>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <div className="flex-1 p-4 md:p-8">
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-semibold tracking-tight mb-1">
              Discover Founders
            </h1>
            <p className="text-sm text-muted-foreground">
              Profile {currentIndex + 1} of {items.length}
              {invitesRemaining !== null && (
                <span className="ml-1.5">
                  &middot; {invitesRemaining} invites left this week
                </span>
              )}
            </p>
          </div>

          {currentItem && currentProfile && (
            <Card className="py-0">
              <CardContent className="p-6 sm:p-8 md:p-10 space-y-6">
                {/* Matched before banner */}
                {currentItem.matched_before && (
                  <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    <Rocket className="size-4 shrink-0" />
                    You matched with this person before
                  </div>
                )}

                {/* Header: Avatar + Name + Meta badges */}
                <div className="flex flex-col sm:flex-row items-start gap-5">
                  <Avatar className="size-20 sm:size-24">
                    {currentProfile.avatar_url ? (
                      <AvatarImage
                        src={currentProfile.avatar_url}
                        alt={currentProfile.name}
                      />
                    ) : null}
                    <AvatarFallback className="text-2xl font-semibold">
                      {currentProfile.name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <h2 className="text-2xl font-semibold tracking-tight mb-1">
                      {currentProfile.name}
                    </h2>

                    {currentProfile.location && (
                      <p className="flex items-center gap-1.5 text-sm text-muted-foreground mb-3">
                        <MapPin className="size-3.5" />
                        {currentProfile.location}
                      </p>
                    )}

                    <div className="flex flex-wrap gap-2">
                      {currentProfile.idea_status && (
                        <Badge variant="default">
                          {currentProfile.idea_status.replace(/_/g, " ")}
                        </Badge>
                      )}
                      {currentProfile.commitment && (
                        <Badge variant="secondary">
                          {currentProfile.commitment === "full_time"
                            ? "Full-time"
                            : currentProfile.commitment === "part_time"
                              ? "Part-time"
                              : "Exploratory"}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                {/* Introduction */}
                {currentProfile.introduction && (
                  <>
                    <Separator />
                    <div>
                      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                        About
                      </h3>
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">
                        {currentProfile.introduction}
                      </p>
                    </div>
                  </>
                )}

                {/* Experience */}
                {(currentProfile.experience_years !== null && currentProfile.experience_years !== undefined) ||
                (currentProfile.previous_startups !== null && currentProfile.previous_startups !== undefined) ? (
                  <>
                    <Separator />
                    <div>
                      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                        Experience
                      </h3>
                      <div className="grid sm:grid-cols-2 gap-3">
                        {currentProfile.experience_years !== null && currentProfile.experience_years !== undefined && (
                          <div className="flex items-center gap-2 text-sm">
                            <Briefcase className="size-4 text-muted-foreground shrink-0" />
                            <span>
                              <span className="font-medium">{currentProfile.experience_years}</span>{" "}
                              years of experience
                            </span>
                          </div>
                        )}
                        {currentProfile.previous_startups !== null && currentProfile.previous_startups !== undefined && (
                          <div className="flex items-center gap-2 text-sm">
                            <Rocket className="size-4 text-muted-foreground shrink-0" />
                            <span>
                              <span className="font-medium">{currentProfile.previous_startups}</span>{" "}
                              previous startup{currentProfile.previous_startups !== 1 ? "s" : ""}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                ) : null}

                {/* Areas & Topics */}
                {((currentProfile.areas_of_ownership?.length ?? 0) > 0 || (currentProfile.topics_of_interest?.length ?? 0) > 0) && (
                  <>
                    <Separator />
                    <div>
                      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                        Areas & Interests
                      </h3>
                      <div className="flex flex-wrap gap-1.5">
                        {(currentProfile.areas_of_ownership ?? []).map((area) => (
                          <Badge key={area} variant="secondary">
                            {area.replace(/_/g, " ")}
                          </Badge>
                        ))}
                        {(currentProfile.topics_of_interest ?? []).map((topic) => (
                          <Badge key={topic} variant="outline">
                            {topic}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {/* Social Links */}
                {(currentProfile.github_url || currentProfile.linkedin_url || currentProfile.portfolio_url) && (
                  <>
                    <Separator />
                    <div>
                      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                        Links
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {currentProfile.github_url && (
                          <Button
                            variant="outline"
                            size="sm"
                            render={
                              <a
                                href={safeHref(currentProfile.github_url)}
                                target="_blank"
                                rel="noopener noreferrer"
                              />
                            }
                          >
                            <Github className="size-3.5" />
                            GitHub
                          </Button>
                        )}
                        {currentProfile.linkedin_url && (
                          <Button
                            variant="outline"
                            size="sm"
                            render={
                              <a
                                href={safeHref(currentProfile.linkedin_url)}
                                target="_blank"
                                rel="noopener noreferrer"
                              />
                            }
                          >
                            <Linkedin className="size-3.5" />
                            LinkedIn
                          </Button>
                        )}
                        {currentProfile.portfolio_url && (
                          <Button
                            variant="outline"
                            size="sm"
                            render={
                              <a
                                href={safeHref(currentProfile.portfolio_url)}
                                target="_blank"
                                rel="noopener noreferrer"
                              />
                            }
                          >
                            <Globe className="size-3.5" />
                            Portfolio
                          </Button>
                        )}
                      </div>
                    </div>
                  </>
                )}

                {/* Action Bar */}
                <Separator />
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={() => handleSkip(currentProfile.id)}
                    disabled={skipping === currentProfile.id}
                    className="gap-2"
                  >
                    {skipping === currentProfile.id ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <SkipForward className="size-4" />
                    )}
                    {skipping === currentProfile.id ? "Skipping..." : "Skip"}
                  </Button>

                  <Button
                    variant="secondary"
                    size="lg"
                    onClick={() => handleSave(currentProfile.id)}
                    disabled={saving === currentProfile.id || savedProfiles.has(currentProfile.id)}
                    className="gap-2"
                  >
                    <Star
                      className={`size-4 ${savedProfiles.has(currentProfile.id) ? "fill-yellow-500 text-yellow-500" : ""}`}
                    />
                    {saving === currentProfile.id
                      ? "Saving..."
                      : savedProfiles.has(currentProfile.id)
                        ? "Saved"
                        : "Save"}
                  </Button>

                  <Button
                    size="lg"
                    onClick={handleInviteClick}
                    disabled={inviting === currentProfile.id}
                    className="flex-1 gap-2 bg-green-600 hover:bg-green-700 text-white"
                  >
                    {inviting === currentProfile.id ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Send className="size-4" />
                    )}
                    {inviting === currentProfile.id ? "Sending..." : "Invite to Connect"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Navigation */}
          {items.length > 1 && (
            <div className="mt-6 flex justify-center gap-2">
              <Button
                variant="outline"
                onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
                disabled={currentIndex === 0}
                className="gap-1.5"
              >
                <ChevronLeft className="size-4" />
                Previous
              </Button>
              <Button
                variant="outline"
                onClick={() => setCurrentIndex(Math.min(items.length - 1, currentIndex + 1))}
                disabled={currentIndex === items.length - 1}
                className="gap-1.5"
              >
                Next
                <ChevronRight className="size-4" />
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Invite Modal */}
      <Dialog open={showInviteModal} onOpenChange={setShowInviteModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Invite {currentProfile?.name} to connect
            </DialogTitle>
            <DialogDescription>
              Write a message explaining why you&apos;d like to connect (optional).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <label htmlFor="invite-message" className="sr-only">
              Message to {currentProfile?.name}
            </label>
            <Textarea
              id="invite-message"
              value={inviteMessage}
              onChange={(e) => setInviteMessage(e.target.value)}
              placeholder="Hi! I'm interested in connecting because... (optional)"
              rows={5}
              maxLength={500}
              className="resize-none"
            />
            <p aria-live="polite" aria-atomic="true" className="text-xs text-muted-foreground text-right">
              {inviteMessage.length}/500
            </p>
          </div>

          <DialogFooter>
            <DialogClose
              render={<Button variant="outline" />}
            >
              Cancel
            </DialogClose>
            <Button
              onClick={handleSendInvite}
              disabled={inviting === currentProfile?.id}
              className="gap-2 bg-green-600 hover:bg-green-700 text-white"
            >
              {inviting === currentProfile?.id ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Send className="size-4" />
              )}
              {inviting === currentProfile?.id ? "Sending..." : "Send Invitation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  )
}
