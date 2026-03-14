"""
PrithviNet - Community Feed API
Citizens can share their environmental protection activities.
Posts are public; any citizen can like and comment.
"""

import base64
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Form, UploadFile, File, HTTPException
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import CommunityPost, PostLike, PostComment, User
from schemas import PostOut, CommentOut, LeaderboardEntry
from dependencies import get_current_user

router = APIRouter(prefix="/community", tags=["Community"])


# ── helpers ────────────────────────────────────────────────────

async def _enrich_post(post: CommunityPost, current_user_id: int, db: AsyncSession) -> PostOut:
    """Attach author_name, likes_count, comments_count, liked_by_me."""
    author = await db.get(User, post.user_id)
    likes_count = (
        await db.execute(
            select(func.count()).where(PostLike.post_id == post.id)
        )
    ).scalar_one()
    comments_count = (
        await db.execute(
            select(func.count()).where(PostComment.post_id == post.id)
        )
    ).scalar_one()
    liked_by_me = (
        await db.execute(
            select(PostLike).where(
                PostLike.post_id == post.id,
                PostLike.user_id == current_user_id,
            )
        )
    ).scalar_one_or_none() is not None

    return PostOut(
        id=post.id,
        user_id=post.user_id,
        author_name=author.name if author else "Unknown",
        content=post.content,
        photo_data=post.photo_data,
        photo_filename=post.photo_filename,
        likes_count=likes_count,
        comments_count=comments_count,
        liked_by_me=liked_by_me,
        created_at=post.created_at,
    )


# ── Posts ──────────────────────────────────────────────────────

@router.post("/posts", response_model=PostOut, status_code=201)
async def create_post(
    content: str = Form(...),
    photo: UploadFile | None = File(default=None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new community post (any authenticated user)."""
    if not content.strip():
        raise HTTPException(status_code=400, detail="Post content cannot be empty.")

    photo_data = None
    photo_filename = None
    if photo and photo.filename:
        if not (photo.content_type or "").startswith("image/"):
            raise HTTPException(status_code=400, detail="Photo must be an image file.")
        raw = await photo.read()
        if len(raw) > 5 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="Photo must be smaller than 5 MB.")
        photo_data = base64.b64encode(raw).decode("utf-8")
        photo_filename = photo.filename

    post = CommunityPost(
        user_id=current_user.id,
        content=content.strip(),
        photo_data=photo_data,
        photo_filename=photo_filename,
    )
    db.add(post)
    await db.commit()
    await db.refresh(post)
    return await _enrich_post(post, current_user.id, db)


@router.get("/posts", response_model=list[PostOut])
async def list_posts(
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all community posts, newest first."""
    result = await db.execute(
        select(CommunityPost).order_by(desc(CommunityPost.created_at)).limit(limit)
    )
    posts = result.scalars().all()
    return [await _enrich_post(p, current_user.id, db) for p in posts]


# ── Likes ──────────────────────────────────────────────────────

@router.post("/posts/{post_id}/like", response_model=PostOut)
async def toggle_like(
    post_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Toggle like on a post (like if not liked, unlike if already liked)."""
    post = await db.get(CommunityPost, post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Post not found.")

    existing = (
        await db.execute(
            select(PostLike).where(
                PostLike.post_id == post_id,
                PostLike.user_id == current_user.id,
            )
        )
    ).scalar_one_or_none()

    if existing:
        await db.delete(existing)
    else:
        db.add(PostLike(post_id=post_id, user_id=current_user.id))

    await db.commit()
    return await _enrich_post(post, current_user.id, db)


# ── Comments ───────────────────────────────────────────────────

@router.get("/posts/{post_id}/comments", response_model=list[CommentOut])
async def get_comments(
    post_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get all comments for a post."""
    result = await db.execute(
        select(PostComment)
        .where(PostComment.post_id == post_id)
        .order_by(PostComment.created_at)
    )
    comments = result.scalars().all()
    out = []
    for c in comments:
        author = await db.get(User, c.user_id)
        out.append(CommentOut(
            id=c.id,
            post_id=c.post_id,
            user_id=c.user_id,
            author_name=author.name if author else "Unknown",
            content=c.content,
            created_at=c.created_at,
        ))
    return out


@router.post("/posts/{post_id}/comments", response_model=CommentOut, status_code=201)
async def add_comment(
    post_id: int,
    content: str = Form(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Add a comment to a post."""
    post = await db.get(CommunityPost, post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Post not found.")
    if not content.strip():
        raise HTTPException(status_code=400, detail="Comment cannot be empty.")

    comment = PostComment(post_id=post_id, user_id=current_user.id, content=content.strip())
    db.add(comment)
    await db.commit()
    await db.refresh(comment)
    return CommentOut(
        id=comment.id,
        post_id=comment.post_id,
        user_id=comment.user_id,
        author_name=current_user.name,
        content=comment.content,
        created_at=comment.created_at,
    )


# ── Leaderboard ────────────────────────────────────────────────

@router.get("/leaderboard", response_model=list[LeaderboardEntry])
async def get_leaderboard(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Citizen leaderboard ranked by engagement score.
    Score = (posts × 3) + (likes received × 2) + (comments received × 1)
    """
    # Aggregate posts per user
    posts_q = await db.execute(
        select(CommunityPost.user_id, func.count(CommunityPost.id).label("posts_count"))
        .group_by(CommunityPost.user_id)
    )
    posts_map: dict[int, int] = {r.user_id: r.posts_count for r in posts_q}

    # Aggregate likes received per user
    likes_q = await db.execute(
        select(CommunityPost.user_id, func.count(PostLike.id).label("likes_count"))
        .join(PostLike, PostLike.post_id == CommunityPost.id)
        .group_by(CommunityPost.user_id)
    )
    likes_map: dict[int, int] = {r.user_id: r.likes_count for r in likes_q}

    # Aggregate comments received per user
    comments_q = await db.execute(
        select(CommunityPost.user_id, func.count(PostComment.id).label("comments_count"))
        .join(PostComment, PostComment.post_id == CommunityPost.id)
        .group_by(CommunityPost.user_id)
    )
    comments_map: dict[int, int] = {r.user_id: r.comments_count for r in comments_q}

    # Build ranked list
    all_user_ids = set(posts_map) | set(likes_map) | set(comments_map)
    entries = []
    for uid in all_user_ids:
        user = await db.get(User, uid)
        if not user:
            continue
        p = posts_map.get(uid, 0)
        l = likes_map.get(uid, 0)
        c = comments_map.get(uid, 0)
        score = p * 3 + l * 2 + c
        entries.append({"user_id": uid, "name": user.name, "posts_count": p, "total_likes": l, "total_comments": c, "score": score})

    entries.sort(key=lambda x: x["score"], reverse=True)
    return [
        LeaderboardEntry(rank=i + 1, **e)
        for i, e in enumerate(entries)
    ]
