"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { NOTIFICATION_TYPES, NOTIFICATION_TARGETS } from "@/lib/constants";
import { searchUsers } from "@/app/admin/notifications/actions";
import { Send, Loader2 } from "lucide-react";

export function NotificationComposer() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [type, setType] = useState("custom");
  const [targetType, setTargetType] = useState("all");
  const [targetValue, setTargetValue] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [userResults, setUserResults] = useState<
    { id: string; email: string; full_name: string | null }[]
  >([]);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  async function handleUserSearch(query: string) {
    setUserSearch(query);
    if (query.length < 2) {
      setUserResults([]);
      return;
    }
    const results = await searchUsers(query);
    setUserResults(results);
  }

  async function handleSend() {
    if (!title.trim() || !body.trim()) return;

    setSending(true);
    setResult(null);

    try {
      const res = await fetch("/api/notifications/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          body: body.trim(),
          imageUrl: imageUrl.trim() || undefined,
          data: linkUrl.trim() ? { url: linkUrl.trim() } : undefined,
          type,
          targetType,
          targetValue: targetType === "all" ? undefined : targetValue,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setResult({
          success: true,
          message: `Notification sent successfully! (${data.sentCount} delivered, ${data.failedCount} failed)`,
        });
        setTitle("");
        setBody("");
        setImageUrl("");
        setLinkUrl("");
        setType("custom");
        setTargetType("all");
        setTargetValue("");
        setUserSearch("");
      } else {
        setResult({ success: false, message: data.error || "Failed to send" });
      }
    } catch {
      setResult({ success: false, message: "Network error" });
    } finally {
      setSending(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Send Notification</CardTitle>
        <CardDescription>
          Compose and send push notifications to your app users
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="notif-type">Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger id="notif-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {NOTIFICATION_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notif-target">Target</Label>
            <Select value={targetType} onValueChange={setTargetType}>
              <SelectTrigger id="notif-target">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {NOTIFICATION_TARGETS.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {targetType === "user" && (
          <div className="space-y-2">
            <Label>Search User</Label>
            <Input
              placeholder="Search by name or email..."
              value={userSearch}
              onChange={(e) => handleUserSearch(e.target.value)}
            />
            {userResults.length > 0 && (
              <div className="rounded-md border bg-card">
                {userResults.map((user) => (
                  <button
                    key={user.id}
                    type="button"
                    className={`w-full px-3 py-2 text-left text-sm hover:bg-accent ${
                      targetValue === user.id ? "bg-accent" : ""
                    }`}
                    onClick={() => {
                      setTargetValue(user.id);
                      setUserSearch(
                        user.full_name || user.email
                      );
                      setUserResults([]);
                    }}
                  >
                    <span className="font-medium">
                      {user.full_name || "No name"}
                    </span>{" "}
                    <span className="text-muted-foreground">{user.email}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {targetType === "topic" && (
          <div className="space-y-2">
            <Label htmlFor="notif-topic">Topic Name</Label>
            <Input
              id="notif-topic"
              placeholder="e.g., promotions"
              value={targetValue}
              onChange={(e) => setTargetValue(e.target.value)}
            />
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="notif-title">Title</Label>
          <Input
            id="notif-title"
            placeholder="Notification title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="notif-body">Message</Label>
          <Textarea
            id="notif-body"
            placeholder="Notification message..."
            rows={3}
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="notif-image">Image URL (optional)</Label>
          <Input
            id="notif-image"
            placeholder="https://..."
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="notif-link">Link URL (optional)</Label>
          <Input
            id="notif-link"
            placeholder="/products/gold-chain"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
          />
        </div>

        {result && (
          <p
            className={`text-sm ${
              result.success ? "text-green-600" : "text-red-600"
            }`}
          >
            {result.message}
          </p>
        )}

        <Button
          onClick={handleSend}
          disabled={sending || !title.trim() || !body.trim()}
          className="w-full sm:w-auto"
        >
          {sending ? (
            <Loader2 className="mr-2 size-4 animate-spin" />
          ) : (
            <Send className="mr-2 size-4" />
          )}
          {sending ? "Sending..." : "Send Notification"}
        </Button>
      </CardContent>
    </Card>
  );
}
