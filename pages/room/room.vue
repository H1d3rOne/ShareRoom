<template>
  <div class="container">
    <div class="ambient ambient-left"></div>
    <div class="ambient ambient-right"></div>
    <div class="ambient ambient-bottom"></div>

    <input
      ref="fileInputRef"
      class="hidden-input"
      type="file"
      accept="image/*,video/*"
      @change="handleFileChange"
    />

    <header class="header">
      <div class="header-main">
        <div class="room-title-row">
          <div class="room-title-block">
            <span class="room-title">房间 {{ roomId }}</span>
            <span class="participant-chip stage-chip">
              {{ showGameStage ? (activeGame ? '互动进行中' : '游戏菜单') : activeShare ? `共享中 · ${getShareKindLabel(activeShare.kind)}` : '共享待命' }}
            </span>
          </div>
          <span class="participant-chip">{{ userCount }} 人在线</span>
          <span class="participant-chip self-chip profile-chip">
            <UserAvatar :avatar-id="selfAvatarId" :name="displayName" :size="30" />
            <span>{{ displayName }}</span>
          </span>
          <span class="participant-chip" :class="isAdmin ? 'admin-chip' : 'member-chip'">
            {{ isSuperAdmin ? '超级管理员' : isAdmin ? '管理员' : '普通成员' }}
          </span>
        </div>
        <p class="room-hint">仅管理员可共享文件并控制共享区域；普通成员可本地观看视频。</p>
      </div>
      <div class="header-actions">
        <button class="leave-btn" @click="leaveRoom">离开房间</button>
      </div>
    </header>

    <main class="content">
      <section class="shared-section">
        <div class="shared-overview">
          <div class="shared-overview-copy">
            <span class="section-kicker">Shared Stage</span>
            <div class="section-title-row">
              <h2 class="section-title" :title="getSharedOverviewTitle()">
                {{ getSharedOverviewDisplayTitle() }}
              </h2>
              <span class="section-state">
                {{ showGameStage ? (activeGame ? '实时同步' : '可发起邀请') : activeShare ? getShareKindLabel(activeShare.kind) : '等待共享' }}
              </span>
            </div>
            <p class="section-caption">
              {{
                showGameStage
                  ? '游戏、邀请和对局状态都会显示在这里，房间成员可同步观看与互动。'
                  : activeShare
                    ? '共享内容、远控指针和播放/缩放状态会在这里实时同步给房间成员。'
                    : '房主开始共享文件、屏幕或打开游戏菜单后，主舞台会在这里展开。'
              }}
            </p>
          </div>
        </div>

        <div class="stage-shell">
          <div
            ref="sharedStageRef"
            class="shared-stage"
            :class="{ empty: !activeShare && !showGameStage, controllable: canSendRemoteControlCommands && !showGameStage, 'game-mode': showGameStage }"
            tabindex="0"
            @mousemove="handleSharedStagePointerMove"
            @mouseleave="handleSharedStagePointerLeave"
            @mousedown="handleSharedStageMouseDown"
            @click="handleSharedStageClick"
            @dblclick="handleSharedStageDoubleClick"
            @contextmenu="handleSharedStageContextMenu"
            @wheel="handleSharedStageWheel"
            @keydown="handleSharedStageKeydown"
          >
            <template v-if="showGameStage">
              <div class="game-stage">
                <div class="game-panel stage-embedded" :class="{ 'in-match': Boolean(activeGame) }">
                  <div class="game-panel-hero">
                    <div class="game-panel-hero-copy">
                      <span class="game-panel-kicker">Game Lounge</span>
                      <strong>{{ activeGame ? '房间对局已进入主舞台' : '在共享区直接发起一局互动' }}</strong>
                      <p v-if="!activeGame">邀请房间成员加入，所有玩家都会在同一舞台中看到实时状态、回合与结果。</p>
                    </div>
                    <div class="game-panel-hero-orbs" aria-hidden="true">
                      <span class="game-orb blue"></span>
                      <span class="game-orb rose"></span>
                      <span class="game-orb gold"></span>
                    </div>
                  </div>

                <div class="game-panel-header">
                  <div>
                    <div class="panel-title">{{ activeGame ? getGameTypeLabel(activeGame.gameType) : '游戏菜单' }}</div>
                    <p v-if="!activeGame" class="game-panel-subtitle">{{ gamePanelSubtitle }}</p>
                  </div>
                  <div class="game-panel-tools">
                    <div class="game-panel-status">{{ gamePanelStatus }}</div>
                    <button type="button" class="ghost-btn stage-fullscreen-btn" title="全屏" @click.stop="toggleSharedStageFullscreen">
                      <svg class="control-icon" viewBox="0 0 24 24" aria-hidden="true">
                        <polyline points="15 3 21 3 21 9"/>
                        <polyline points="9 21 3 21 3 15"/>
                        <line x1="21" y1="3" x2="14" y2="10"/>
                        <line x1="3" y1="21" x2="10" y2="14"/>
                      </svg>
                    </button>
                    <button v-if="canShare" type="button" class="ghost-btn danger close-stage-btn" title="关闭共享" @click.stop="closeGameStage">
                      关闭共享
                    </button>
                  </div>
                </div>

                <div class="game-launcher-grid" v-if="showGameCatalog">
                  <button
                    v-for="app in gameApps"
                    :key="app.id"
                    type="button"
                    class="game-app-button"
                    :class="app.id"
                    @click.stop="openGameHome(app.id)"
                  >
                    <span class="game-app-icon-frame" aria-hidden="true">
                      <svg v-if="app.id === 'gomoku'" class="game-app-icon-svg" viewBox="0 0 64 64">
                        <path d="M14 14h36v36H14z" fill="none" stroke="currentColor" stroke-width="2.5" opacity="0.4" />
                        <path d="M24 14v36M34 14v36M44 14v36M14 24h36M14 34h36M14 44h36" fill="none" stroke="currentColor" stroke-width="2.5" opacity="0.55" />
                        <circle cx="24" cy="24" r="5.5" fill="#0f172a" stroke="#e2e8f0" stroke-width="1.8" />
                        <circle cx="34" cy="34" r="5.5" fill="#f8fafc" stroke="#94a3b8" stroke-width="1.8" />
                        <circle cx="44" cy="24" r="5.5" fill="#0f172a" stroke="#e2e8f0" stroke-width="1.8" />
                      </svg>
                      <svg v-else class="game-app-icon-svg" viewBox="0 0 64 64">
                        <rect x="14" y="18" width="18" height="28" rx="5" fill="#f8fafc" opacity="0.98" />
                        <rect x="24" y="14" width="18" height="28" rx="5" fill="#e2e8f0" opacity="0.96" />
                        <rect x="34" y="18" width="18" height="28" rx="5" fill="#fff7ed" opacity="0.96" />
                        <path d="M29 20c2 4-2 8-4 10 4 0 7 2 8 6" fill="none" stroke="#dc2626" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
                        <path d="M42 22l3 4 5 .8-3.6 3.4.8 5.1-4.6-2.5-4.6 2.5.8-5.1-3.6-3.4 5-.8 2.8-4Z" fill="#f59e0b" opacity="0.9" />
                      </svg>
                    </span>
                    <span class="game-app-name">{{ app.name }}</span>
                    <span class="game-app-subtitle">{{ app.subtitle }}</span>
                    <span class="game-app-meta">{{ app.meta }}</span>
                  </button>
                </div>

                <div v-if="showGameHome && selectedGameType === 'gomoku'" class="game-home-panel">
                  <div class="game-home-header">
                    <button type="button" class="game-home-back" @click.stop="backToGameCatalog">
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="m15 18-6-6 6-6" />
                      </svg>
                      <span>返回游戏菜单</span>
                    </button>
                    <div class="game-home-hero">
                      <span class="game-home-icon gomoku" aria-hidden="true">
                        <svg class="game-app-icon-svg" viewBox="0 0 64 64">
                          <path d="M14 14h36v36H14z" fill="none" stroke="currentColor" stroke-width="2.5" opacity="0.4" />
                          <path d="M24 14v36M34 14v36M44 14v36M14 24h36M14 34h36M14 44h36" fill="none" stroke="currentColor" stroke-width="2.5" opacity="0.55" />
                          <circle cx="24" cy="24" r="5.5" fill="#0f172a" stroke="#e2e8f0" stroke-width="1.8" />
                          <circle cx="34" cy="34" r="5.5" fill="#f8fafc" stroke="#94a3b8" stroke-width="1.8" />
                          <circle cx="44" cy="24" r="5.5" fill="#0f172a" stroke="#e2e8f0" stroke-width="1.8" />
                        </svg>
                      </span>
                      <div class="game-home-copy">
                        <span class="game-home-kicker">Game Home</span>
                        <h3 class="game-home-title">五子棋</h3>
                        <p class="game-home-subtitle">进入游戏后会先显示对局位。你的头像固定在第一位，点击空位上的 + 后，可在右侧成员列表一键邀请成员。</p>
                      </div>
                    </div>
                  </div>

                  <div class="game-home-summary">
                    <span>双人对局位</span>
                    <strong>{{ selectedGomokuPeer ? `${displayName} VS ${selectedGomokuPeer.name}` : '点击右侧空位上的 +，再到成员列表发起邀请' }}</strong>
                  </div>

                  <div class="game-seat-grid two-seat">
                    <article class="game-seat-card self-seat">
                      <div class="game-seat-main">
                        <UserAvatar :avatar-id="selfAvatarId" :name="displayName" :size="52" />
                        <div class="game-seat-copy">
                          <strong>{{ displayName }}</strong>
                          <span>1 号位 · 我</span>
                        </div>
                      </div>
                    </article>

                    <button
                      v-if="!selectedGomokuPeer"
                      type="button"
                      class="game-seat-card invite-seat"
                      :disabled="!gomokuInviteTargets.length || !canInviteGomoku || Boolean(gameInvite)"
                      @click.stop="openInvitePicker('gomoku', 0)"
                    >
                      <span class="game-seat-plus" aria-hidden="true">
                        <svg viewBox="0 0 24 24">
                          <path d="M12 5v14M5 12h14" />
                        </svg>
                      </span>
                      <strong>邀请成员</strong>
                      <span>点击 + 后到成员列表选择</span>
                    </button>

                    <article v-else class="game-seat-card selected-seat">
                      <div class="game-seat-main">
                        <UserAvatar :avatar-id="selectedGomokuPeer.avatarId" :name="selectedGomokuPeer.name" :size="52" />
                        <div class="game-seat-copy">
                          <strong>{{ selectedGomokuPeer.name }}</strong>
                          <span>{{ isPeerConnected(selectedGomokuPeer.id) ? '2 号位 · 已邀请' : '2 号位 · 连接中' }}</span>
                        </div>
                      </div>
                      <button type="button" class="seat-clear-btn" @click.stop="clearGomokuInvitee">
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path d="m6 6 12 12M18 6 6 18" />
                        </svg>
                      </button>
                    </article>
                  </div>

                  <div v-if="invitePicker.visible && invitePicker.gameType === 'gomoku'" class="game-seat-picker">
                    <div class="game-seat-picker-header">
                      <div>
                        <span class="game-seat-picker-kicker">选择成员</span>
                        <strong>为五子棋 2 号位选择一位成员</strong>
                      </div>
                      <button type="button" class="seat-picker-close" @click.stop="closeInvitePicker">
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path d="m6 6 12 12M18 6 6 18" />
                        </svg>
                      </button>
                    </div>

                    <div class="seat-picker-grid">
                      <button
                        v-for="peer in invitePickerPeers"
                        :key="peer.id"
                        type="button"
                        class="seat-picker-card"
                        @click.stop="selectPeerForInvite(peer)"
                      >
                        <UserAvatar :avatar-id="peer.avatarId" :name="peer.name" :size="42" />
                        <div class="seat-picker-copy">
                          <strong>{{ peer.name }}</strong>
                          <span>{{ isPeerConnected(peer.id) ? '在线' : '连接中' }}</span>
                        </div>
                      </button>
                    </div>

                    <div v-if="!invitePickerPeers.length" class="game-empty">
                      房间里还没有可邀请的其他成员。
                    </div>
                  </div>
                </div>

                <div v-if="showGameHome && selectedGameType === 'landlord'" class="game-home-panel">
                  <div class="game-home-header">
                    <button type="button" class="game-home-back" @click.stop="backToGameCatalog">
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="m15 18-6-6 6-6" />
                      </svg>
                      <span>返回游戏菜单</span>
                    </button>
                    <div class="game-home-hero">
                      <span class="game-home-icon landlord" aria-hidden="true">
                        <svg class="game-app-icon-svg" viewBox="0 0 64 64">
                          <rect x="14" y="18" width="18" height="28" rx="5" fill="#f8fafc" opacity="0.98" />
                          <rect x="24" y="14" width="18" height="28" rx="5" fill="#e2e8f0" opacity="0.96" />
                          <rect x="34" y="18" width="18" height="28" rx="5" fill="#fff7ed" opacity="0.96" />
                          <path d="M29 20c2 4-2 8-4 10 4 0 7 2 8 6" fill="none" stroke="#dc2626" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
                          <path d="M42 22l3 4 5 .8-3.6 3.4.8 5.1-4.6-2.5-4.6 2.5.8-5.1-3.6-3.4 5-.8 2.8-4Z" fill="#f59e0b" opacity="0.9" />
                        </svg>
                      </span>
                      <div class="game-home-copy">
                        <span class="game-home-kicker">Game Home</span>
                        <h3 class="game-home-title">斗地主</h3>
                        <p class="game-home-subtitle">进入游戏后会先显示 3 个游戏位。你的头像固定在第一位，其余空位点击 + 后，可在右侧成员列表选择成员组局。</p>
                      </div>
                    </div>
                  </div>

                  <div class="game-home-summary">
                    <span>已选择 {{ selectedLandlordPeers.length }}/{{ LANDLORD_INVITEE_COUNT }} 位成员</span>
                    <strong>{{ selectedLandlordPeers.length ? formatNameList(selectedLandlordPeers.map((peer) => peer.name)) : '等待组局' }}</strong>
                  </div>

                  <div class="game-seat-grid three-seat">
                    <article class="game-seat-card self-seat">
                      <div class="game-seat-main">
                        <UserAvatar :avatar-id="selfAvatarId" :name="displayName" :size="52" />
                        <div class="game-seat-copy">
                          <strong>{{ displayName }}</strong>
                          <span>1 号位 · 我</span>
                        </div>
                      </div>
                    </article>

                    <template v-for="(peer, slotIndex) in landlordSeatPeers" :key="`landlord-seat-${slotIndex}`">
                      <button
                        v-if="!peer"
                        type="button"
                        class="game-seat-card invite-seat"
                        :disabled="!landlordInviteTargets.length || Boolean(gameInvite)"
                        @click.stop="openInvitePicker('landlord', slotIndex)"
                      >
                        <span class="game-seat-plus" aria-hidden="true">
                          <svg viewBox="0 0 24 24">
                            <path d="M12 5v14M5 12h14" />
                          </svg>
                        </span>
                        <strong>邀请成员</strong>
                        <span>{{ slotIndex === 0 ? '点击 + 后邀请 2 号位' : '点击 + 后邀请 3 号位' }}</span>
                      </button>

                      <article v-else class="game-seat-card selected-seat">
                        <div class="game-seat-main">
                          <UserAvatar :avatar-id="peer.avatarId" :name="peer.name" :size="52" />
                          <div class="game-seat-copy">
                            <strong>{{ peer.name }}</strong>
                            <span>{{ slotIndex === 0 ? '2 号位' : '3 号位' }} · {{ isPeerConnected(peer.id) ? '已选中' : '连接中' }}</span>
                          </div>
                        </div>
                        <button type="button" class="seat-clear-btn" @click.stop="removeLandlordInviteeAt(slotIndex)">
                          <svg viewBox="0 0 24 24" aria-hidden="true">
                            <path d="m6 6 12 12M18 6 6 18" />
                          </svg>
                        </button>
                      </article>
                    </template>
                  </div>

                  <div v-if="invitePicker.visible && invitePicker.gameType === 'landlord'" class="game-seat-picker">
                    <div class="game-seat-picker-header">
                      <div>
                        <span class="game-seat-picker-kicker">选择成员</span>
                        <strong>为斗地主 {{ invitePicker.slotIndex === 0 ? '2 号位' : '3 号位' }} 选择一位成员</strong>
                      </div>
                      <button type="button" class="seat-picker-close" @click.stop="closeInvitePicker">
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path d="m6 6 12 12M18 6 6 18" />
                        </svg>
                      </button>
                    </div>

                    <div class="seat-picker-grid">
                      <button
                        v-for="peer in invitePickerPeers"
                        :key="peer.id"
                        type="button"
                        class="seat-picker-card"
                        @click.stop="selectPeerForInvite(peer)"
                      >
                        <UserAvatar :avatar-id="peer.avatarId" :name="peer.name" :size="42" />
                        <div class="seat-picker-copy">
                          <strong>{{ peer.name }}</strong>
                          <span>{{ isPeerConnected(peer.id) ? '在线' : '连接中' }}</span>
                        </div>
                      </button>
                    </div>

                    <div v-if="!invitePickerPeers.length" class="game-empty">
                      房间里至少需要 3 人在线，才能开始斗地主。
                    </div>
                  </div>

                  <div class="game-home-actions">
                    <button
                      class="primary-btn"
                      :disabled="!canInviteLandlord || Boolean(gameInvite)"
                      @click.stop="inviteToLandlord"
                    >
                      发起斗地主邀请
                    </button>
                  </div>
                </div>

                <div v-if="gameInvite" class="game-invite-banner">
                  <div class="game-invite-copy">
                    <span class="game-invite-kicker">Game Invite</span>
                    <strong>{{ gameInviteBannerTitle }}</strong>
                    <span>{{ gameInviteBannerText }}</span>
                  </div>
                  <div class="game-invite-actions">
                    <button
                      v-if="isPendingInviteForMe"
                      class="primary-btn compact"
                      @click.stop="respondToGameInvite(true)"
                    >
                      接受
                    </button>
                    <button
                      v-if="isPendingInviteForMe"
                      class="ghost-btn"
                      @click.stop="respondToGameInvite(false)"
                    >
                      拒绝
                    </button>
                    <button
                      v-if="canCancelGameInvite"
                      class="ghost-btn danger"
                      @click.stop="cancelGameInvite"
                    >
                      取消邀请
                    </button>
                  </div>
                </div>

                <div v-if="activeGame?.gameType === 'gomoku'" class="gomoku-section">
                  <div class="game-mode-banner gomoku-mode-banner">
                    <div class="game-mode-copy">
                      <span class="game-mode-kicker">Gomoku Arena</span>
                      <strong>在棋盘交叉点落子，先连成五子即可取胜</strong>
                    </div>
                    <span class="game-mode-badge">{{ activeGame.status === 'finished' ? '对局结束' : '实时对弈' }}</span>
                  </div>
                  <div class="gomoku-header">
                    <div class="gomoku-player-card" :class="{ current: activeGame.currentTurnId === activeGame.blackId }">
                      <UserAvatar :avatar-id="getParticipantAvatarId(activeGame.blackId)" :name="activeGame.blackName" :size="30" />
                      <span class="stone stone-black"></span>
                      <div class="gomoku-player-copy">
                        <strong>{{ activeGame.blackName }}</strong>
                        <em>黑子</em>
                      </div>
                    </div>
                    <div class="gomoku-status">
                      <strong>{{ gomokuStatusText }}</strong>
                      <span>{{ gomokuStatusSubtext }}</span>
                    </div>
                    <div class="gomoku-player-card" :class="{ current: activeGame.currentTurnId === activeGame.whiteId }">
                      <UserAvatar :avatar-id="getParticipantAvatarId(activeGame.whiteId)" :name="activeGame.whiteName" :size="30" />
                      <span class="stone stone-white"></span>
                      <div class="gomoku-player-copy">
                        <strong>{{ activeGame.whiteName }}</strong>
                        <em>白子</em>
                      </div>
                    </div>
                  </div>

                  <div class="gomoku-board-shell">
                    <div class="gomoku-board-wrap">
                      <div class="gomoku-board">
                        <template v-for="(row, rowIndex) in gomokuBoard" :key="rowIndex">
                          <button
                            v-for="(cell, colIndex) in row"
                            :key="`${rowIndex}-${colIndex}`"
                            class="gomoku-cell"
                            :class="{
                              occupied: Boolean(cell),
                              playable: canPlaceGomokuStone(rowIndex, colIndex),
                              winning: isWinningGomokuCell(rowIndex, colIndex),
                              'edge-top': rowIndex === 0,
                              'edge-bottom': rowIndex === gomokuBoard.length - 1,
                              'edge-left': colIndex === 0,
                              'edge-right': colIndex === row.length - 1
                            }"
                            :disabled="!canPlaceGomokuStone(rowIndex, colIndex)"
                            @click.stop="placeGomokuStone(rowIndex, colIndex)"
                          >
                            <span v-if="cell" class="stone" :class="cell === 'black' ? 'stone-black' : 'stone-white'"></span>
                          </button>
                        </template>
                      </div>
                    </div>
                  </div>

                  <div class="gomoku-actions">
                    <button
                      v-if="activeGame.status === 'playing' && isPlayingGomoku"
                      class="ghost-btn danger"
                      @click.stop="resignGomokuGame"
                    >
                      认输
                    </button>
                    <button
                      v-if="activeGame.status === 'finished' && canCloseActiveGame"
                      class="ghost-btn"
                      @click.stop="closeActiveGame"
                    >
                      关闭游戏
                    </button>
                  </div>
                </div>

                <div v-if="activeGame?.gameType === 'landlord'" class="landlord-section">
                  <div class="game-mode-banner landlord-mode-banner">
                    <div class="game-mode-copy">
                      <span class="game-mode-kicker">Landlord Table</span>
                      <strong>三人牌桌已展开，叫分、出牌与底牌状态会统一同步</strong>
                    </div>
                    <span class="game-mode-badge">{{ activeGame.phase === 'bidding' ? '叫分阶段' : '出牌阶段' }}</span>
                  </div>
                  <div class="landlord-header">
                    <div
                      v-for="player in activeGame.players"
                      :key="player.id"
                      class="landlord-player-card"
                      :class="{
                        current: activeGame.currentTurnId === player.id,
                        landlord: player.role === 'landlord',
                        self: player.id === selfId
                      }"
                    >
                      <div class="landlord-player-top">
                        <div class="landlord-player-identity">
                          <UserAvatar :avatar-id="getParticipantAvatarId(player.id)" :name="player.name" :size="28" />
                          <strong>{{ player.name }}</strong>
                        </div>
                        <span>{{ getLandlordPlayerRoleLabel(player) }}</span>
                      </div>
                      <em>{{ player.cardCount }} 张手牌</em>
                    </div>
                  </div>

                  <div class="landlord-status-card">
                    <div class="landlord-status-main">
                      <strong>{{ landlordStatusText }}</strong>
                      <span>{{ landlordStatusSubtext }}</span>
                    </div>
                    <div v-if="activeGame.bottomCards?.length" class="landlord-bottom-cards">
                      <label>底牌</label>
                      <div class="landlord-card-row table">
                        <span
                          v-for="card in activeGame.bottomCards"
                          :key="card.id"
                          class="landlord-card static"
                          :class="{ red: isLandlordRedCard(card) }"
                        >
                          <span class="landlord-card-rank">{{ getLandlordCardLabel(card) }}</span>
                          <small class="landlord-card-suit">{{ getLandlordCardSuitLabel(card) }}</small>
                        </span>
                      </div>
                    </div>
                  </div>

                  <div class="landlord-table-grid">
                    <div class="landlord-bid-panel">
                      <div class="landlord-panel-title">叫分</div>
                      <div class="landlord-bid-copy">{{ landlordBidWaitingText }}</div>
                      <div v-if="activeGame.bidHistory?.length" class="landlord-bid-history">
                        <div v-for="(item, index) in activeGame.bidHistory" :key="`${item.playerId}-${index}`" class="landlord-bid-history-item">
                          <span>{{ item.playerName }}</span>
                          <em>{{ item.score === 0 ? '不叫' : `${item.score} 分` }}</em>
                        </div>
                      </div>
                      <div v-if="canBidLandlord" class="landlord-bid-actions">
                        <button
                          v-for="score in landlordBidOptions"
                          :key="score"
                          class="secondary-btn"
                          @click.stop="bidLandlordScore(score)"
                        >
                          {{ score === 0 ? '不叫' : `${score} 分` }}
                        </button>
                      </div>
                    </div>

                    <div class="landlord-table-panel">
                      <div class="landlord-panel-title">桌面牌</div>
                      <div v-if="activeGame.currentTrick" class="landlord-current-trick">
                        <div class="landlord-trick-head">
                          <strong>{{ activeGame.currentTrick.playerName }}</strong>
                          <span>{{ activeGame.currentTrick.combination?.label }}</span>
                        </div>
                        <div class="landlord-card-row table">
                          <span
                            v-for="card in activeGame.currentTrick.cards"
                            :key="card.id"
                            class="landlord-card static"
                            :class="{ red: isLandlordRedCard(card) }"
                          >
                            <span class="landlord-card-rank">{{ getLandlordCardLabel(card) }}</span>
                            <small class="landlord-card-suit">{{ getLandlordCardSuitLabel(card) }}</small>
                          </span>
                        </div>
                      </div>
                      <div v-else class="game-empty">
                        {{ activeGame.phase === 'bidding' ? '叫分完成后，地主会率先出牌。' : '等待当前轮次首家出牌。' }}
                      </div>
                    </div>
                  </div>

                  <div v-if="isLandlordParticipant" class="landlord-hand-panel">
                    <div class="landlord-hand-header">
                      <strong>我的手牌</strong>
                      <span>{{ myLandlordHand.length }} 张</span>
                    </div>
                    <div class="landlord-card-row hand">
                      <button
                        v-for="card in myLandlordHand"
                        :key="card.id"
                        type="button"
                        class="landlord-card"
                        :class="{
                          selected: selectedLandlordCardIds.includes(card.id),
                          red: isLandlordRedCard(card),
                          disabled: !canInteractLandlordHand
                        }"
                        @click.stop="toggleLandlordCard(card.id)"
                      >
                        <span class="landlord-card-rank">{{ getLandlordCardLabel(card) }}</span>
                        <small class="landlord-card-suit">{{ getLandlordCardSuitLabel(card) }}</small>
                      </button>
                    </div>

                    <div v-if="activeGame.phase === 'playing'" class="landlord-actions">
                      <button
                        class="primary-btn compact"
                        :disabled="!canPlayLandlordCards"
                        @click.stop="playSelectedLandlordCards"
                      >
                        出牌
                      </button>
                      <button
                        class="ghost-btn"
                        :disabled="!canPassLandlordTurn"
                        @click.stop="passLandlordTurn"
                      >
                        不要
                      </button>
                      <button
                        class="ghost-btn"
                        :disabled="!selectedLandlordCardIds.length"
                        @click.stop="clearSelectedLandlordCards"
                      >
                        清空选择
                      </button>
                    </div>
                  </div>

                  <div v-else class="game-empty">
                    当前为观战视角，仅显示桌面牌和玩家剩余手牌数量。
                  </div>

                  <div class="gomoku-actions">
                    <button
                      v-if="activeGame.status === 'finished' && canCloseActiveGame"
                      class="ghost-btn"
                      @click.stop="closeActiveGame"
                    >
                      关闭游戏
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </template>

          <template v-else-if="activeShare">
            <img
              v-if="activeShare.kind === 'image' && activeShare.url"
              :src="activeShare.url"
              class="shared-image"
              :class="{ zoomed: activeShare.zoomed, readonly: !canControlShare }"
              @click="toggleSharedImageZoom"
            />

            <video
              v-else-if="isVideoLikeShare(activeShare)"
              ref="sharedVideoRef"
              class="shared-video"
              :src="getSharedVideoSource(activeShare)"
              autoplay
              :muted="shouldMuteSharedVideo(activeShare)"
              playsinline
              preload="auto"
              @loadedmetadata="handleSharedVideoLoaded"
              @canplay="handleSharedVideoCanPlay"
              @playing="handleSharedVideoPlaying"
              @play="handleSharedVideoPlay"
              @pause="handleSharedVideoPause"
              @seeked="handleSharedVideoSeek"
              @timeupdate="handleSharedVideoTimeUpdate"
            ></video>

            <div v-else-if="activeShare.kind === 'webpage'" ref="webpageShareContainerRef" class="webpage-share-container">
              <div class="webpage-toolbar">
                <button
                  type="button"
                  class="webpage-nav-btn"
                  :disabled="!canStepBackwardSharedWebpage"
                  title="后退"
                  @click.stop="goBackSharedWebpage"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="m15 18-6-6 6-6" />
                  </svg>
                </button>
                <button
                  type="button"
                  class="webpage-nav-btn"
                  :disabled="!canStepForwardSharedWebpage"
                  title="前进"
                  @click.stop="goForwardSharedWebpage"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="m9 6 6 6-6 6" />
                  </svg>
                </button>
                <button
                  type="button"
                  class="webpage-nav-btn refresh"
                  :disabled="!canRefreshSharedWebpage"
                  title="刷新"
                  @click.stop="refreshSharedWebpage"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M20 11a8 8 0 1 0 2 5.3" />
                    <path d="M20 4v7h-7" />
                  </svg>
                </button>
                <button
                  type="button"
                  class="webpage-nav-btn fullscreen"
                  title="全屏"
                  @click.stop="toggleSharedWebpageFullscreen"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <polyline points="15 3 21 3 21 9"/>
                    <polyline points="9 21 3 21 3 15"/>
                    <line x1="21" y1="3" x2="14" y2="10"/>
                    <line x1="3" y1="21" x2="10" y2="14"/>
                  </svg>
                </button>
              </div>
              <div v-if="!webpageLoaded" class="webpage-loading">
                <div class="loader"></div>
                <p>正在加载网页...</p>
              </div>
              <iframe
                v-for="(entry, index) in getWebpageHistoryEntries(activeShare)"
                :key="getWebpageIframeKey(activeShare, entry, index)"
                :src="entry.url"
                class="webpage-iframe"
                :class="[index === getActiveWebpageHistoryIndex(activeShare) ? 'active' : 'inactive', { hidden: index === getActiveWebpageHistoryIndex(activeShare) && !webpageLoaded }]"
                sandbox="allow-scripts allow-same-origin allow-forms allow-presentation allow-downloads"
                frameborder="0"
                allowfullscreen
                referrerpolicy="no-referrer"
                @load="handleWebpageLoad(entry, index)"
                @error="handleWebpageError(entry, index)"
              ></iframe>
            </div>

            <div v-else class="share-loading">
              <div class="loader"></div>
              <p>正在接收共享文件…</p>
            </div>

            <div class="share-badge" :title="getShareBadgeTitle(activeShare)">{{ getShareBadgeDisplayTitle(activeShare) }}</div>

            <div
              v-if="activeShare.kind === 'screen' && activeShare.pointer?.visible"
              class="remote-pointer"
              :style="getRemotePointerStyle(activeShare.pointer)"
            >
              <span class="remote-pointer-dot"></span>
              <span class="remote-pointer-label">{{ activeShare.pointer.name || '远控指针' }}</span>
            </div>

            <div
              v-if="activeShare.kind === 'screen' && remoteCommandOverlay.visible"
              class="remote-command-overlay"
              :style="getRemotePointerStyle(remoteCommandOverlay)"
            >
              <span class="remote-command-pulse"></span>
              <span class="remote-command-label">{{ remoteCommandOverlay.label }}</span>
            </div>

            <div v-if="activeShare && canShare" class="share-close-drawer">
              <button type="button" class="share-close-trigger" aria-label="展开关闭面板" @click.stop>
                &lt;
              </button>
              <button type="button" class="share-close-btn" @click.stop="closeSharedMedia">关闭共享</button>
            </div>

            <div v-if="activeShare.kind !== 'webpage'" class="share-footer">
              <div class="share-meta">
                <div v-if="activeShare.kind === 'video'" class="video-control-panel">
                  <button
                    class="control-pill playback-btn"
                    :disabled="!canLocalControlSharedVideo"
                    @click="toggleSharedVideoPlayback"
                    :title="sharedVideoUi.playing ? '暂停' : '播放'"
                  >
                    <svg v-if="!sharedVideoUi.playing" class="control-icon" viewBox="0 0 24 24" aria-hidden="true">
                      <polygon points="5 3 19 12 5 21 5 3"/>
                    </svg>
                    <svg v-else class="control-icon" viewBox="0 0 24 24" aria-hidden="true">
                      <rect x="6" y="4" width="4" height="16"/>
                      <rect x="14" y="4" width="4" height="16"/>
                    </svg>
                  </button>
                  <button
                    class="control-pill volume-btn"
                    :class="{ muted: sharedVideoMuted }"
                    :disabled="!canLocalControlSharedVideo"
                    @click="toggleSharedVideoMute"
                    :title="sharedVideoMuted ? '开启声音' : '静音'"
                  >
                    <svg v-if="sharedVideoMuted" class="control-icon" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M11 5L6 9H2v6h4l5 4V5z"/>
                      <line x1="23" y1="9" x2="17" y2="15"/>
                      <line x1="17" y1="9" x2="23" y2="15"/>
                    </svg>
                    <svg v-else class="control-icon" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M11 5L6 9H2v6h4l5 4V5z"/>
                      <path d="M15.54 8.46a5 5 0 010 7.07"/>
                      <path d="M19.07 4.93a10 10 0 010 14.14"/>
                    </svg>
                  </button>
                  <input
                    class="progress-slider"
                    type="range"
                    min="0"
                    :max="Math.max(sharedVideoUi.duration, 0)"
                    :step="0.1"
                    :value="Math.min(sharedVideoUi.currentTime, sharedVideoUi.duration || 0)"
                    :disabled="!canGlobalControlShare"
                    @input="handleSharedVideoProgressInput"
                    @change="handleSharedVideoProgressInput"
                  />
                  <span class="time-label">
                    {{ formatDuration(sharedVideoUi.currentTime) }} / {{ formatDuration(sharedVideoUi.duration) }}
                  </span>
                  <button
                    class="control-pill fullscreen-btn"
                    :disabled="!canLocalControlSharedVideo"
                    @click="toggleSharedVideoFullscreen"
                    title="全屏"
                  >
                    <svg class="control-icon" viewBox="0 0 24 24" aria-hidden="true">
                      <polyline points="15 3 21 3 21 9"/>
                      <polyline points="9 21 3 21 3 15"/>
                      <line x1="21" y1="3" x2="14" y2="10"/>
                      <line x1="3" y1="21" x2="10" y2="14"/>
                    </svg>
                  </button>
                </div>
              </div>
              <div class="share-actions">
                <button v-if="activeShare.kind === 'image' && canManageSharedMedia" class="ghost-btn" @click="toggleSharedImageZoom">
                  {{ activeShare.zoomed ? '还原' : '放大' }}
                </button>
                <button v-if="activeShare.kind !== 'video'" class="ghost-btn stage-fullscreen-btn" @click="toggleSharedStageFullscreen">
                  <svg class="control-icon" viewBox="0 0 24 24" aria-hidden="true">
                    <polyline points="15 3 21 3 21 9"/>
                    <polyline points="9 21 3 21 3 15"/>
                    <line x1="21" y1="3" x2="14" y2="10"/>
                    <line x1="3" y1="21" x2="10" y2="14"/>
                  </svg>
                  <span>全屏</span>
                </button>
              </div>
            </div>
          </template>

          <div v-else class="empty-share">
            <h3>共享区域</h3>
            <p>{{ canShare ? '选择文件或开始屏幕共享后，房间成员会同步查看内容与操作状态。' : '等待管理员共享图片、视频或屏幕，内容会自动同步到这里。' }}</p>
          </div>
        </div>

        <div class="share-toolbar">
          <div class="share-toolbar-actions">
            <button v-if="canShare" class="primary-btn" @click="chooseMedia">文件共享</button>
            <button v-if="canShare" class="secondary-btn" @click="startScreenShare">屏幕共享</button>
            <button v-if="canShare" class="secondary-btn" @click="openWebpageShareDialog">网页共享</button>
            <button v-if="canOpenGameMenu" class="secondary-btn" :class="{ active: showGameMenu || activeGame || gameInvite }" @click="toggleGameMenu">
              {{ gameMenuButtonLabel }}
            </button>
            <button
              v-if="canRequestRemoteControl"
              class="secondary-btn"
              :disabled="!isConnected"
              @click="requestRemoteControl"
            >
              申请控制 {{ activeShare?.ownerName || '共享者' }}
            </button>
            <button v-if="isRemoteController" class="ghost-btn danger" @click="releaseRemoteControl">结束远控</button>
          </div>
          <div class="share-toolbar-hint">{{ remoteControlHint }}</div>
        </div>
        </div>

        <div class="video-grid" v-if="hasVisibleVideoTiles">
          <div class="video-tile" v-if="hasLocalVideo">
            <video ref="localVideoRef" autoplay playsinline muted></video>
            <div class="video-tile-label">
              <UserAvatar :avatar-id="selfAvatarId" :name="displayName" :size="30" />
              <span>我</span>
            </div>
          </div>

          <div class="video-tile" v-for="peer in participantsWithVideo" :key="peer.id">
            <video :ref="(element) => bindRemoteVideo(peer.id, element)" autoplay playsinline></video>
            <div class="video-tile-label">
              <UserAvatar :avatar-id="peer.avatarId" :name="peer.name" :size="30" />
              <span>{{ peer.name }}</span>
            </div>
          </div>
        </div>
      </section>

      <aside class="sidebar">
        <section class="panel participants-panel">
          <div class="panel-headline">
            <div>
              <div class="panel-kicker">Members</div>
              <div class="panel-title">房间成员</div>
            </div>
            <span class="panel-meta">{{ participants.length }} 人</span>
          </div>
          <div v-if="invitePicker.visible" class="participant-invite-banner">
            <div class="participant-invite-copy">
              <span class="participant-invite-kicker">Invite Mode</span>
              <strong>{{ invitePickerTitle }}</strong>
              <span>{{ invitePickerDescription }}</span>
            </div>
            <button type="button" class="tiny-btn" @click="closeInvitePicker">取消</button>
          </div>
          <div class="participant-list">
            <div
              class="participant-item"
              :class="{ 'invite-target': canInvitePeerFromList(peer), 'seat-assigned': Boolean(getParticipantSeatLabel(peer.id)) }"
              v-for="peer in participants"
              :key="peer.id"
            >
              <div class="participant-main">
                <UserAvatar :avatar-id="peer.avatarId" :name="peer.name" :size="38" />
                <div class="participant-copy">
                  <span>{{ peer.name }}</span>
                  <div class="participant-tags">
                    <span class="participant-tag">
                      {{ peer.isSuperAdmin ? '超级管理员' : peer.isAdmin ? '管理员' : peer.id === selfId ? '我' : isPeerConnected(peer.id) ? '已连接' : '连接中' }}
                    </span>
                    <span v-if="peer.isController" class="participant-tag controller-tag">远控中</span>
                    <span v-if="getParticipantSeatLabel(peer.id)" class="participant-tag seat-tag">{{ getParticipantSeatLabel(peer.id) }}</span>
                  </div>
                </div>
              </div>
              <div class="participant-actions">
                <button
                  v-if="canInvitePeerFromList(peer)"
                  type="button"
                  class="tiny-btn active"
                  @click="selectPeerForInvite(peer)"
                >
                  {{ getInvitePeerActionLabel() }}
                </button>
                <button
                  v-if="canGrantAdmin && !peer.isSuperAdmin && !peer.isAdmin && peer.id !== selfId"
                  class="tiny-btn admin-transfer-btn"
                  @click="grantAdminTo(peer)"
                >
                  授予管理员
                </button>
                <button
                  v-else-if="canGrantAdmin && !peer.isSuperAdmin && peer.isAdmin && peer.id !== selfId"
                  class="tiny-btn admin-transfer-btn danger"
                  @click="revokeAdminFrom(peer)"
                >
                  撤销管理员
                </button>
                <button
                  v-if="canManagePeerRemoteControl(peer)"
                  class="tiny-btn"
                  :class="{ danger: peer.isController }"
                  @click="togglePeerRemoteControl(peer)"
                >
                  {{ peer.isController ? '撤销远控' : '授权远控' }}
                </button>
                <button
                  v-else-if="canRequestPeerRemoteControl(peer)"
                  class="tiny-btn"
                  @click="requestRemoteControl(peer.id)"
                >
                  申请远控
                </button>
              </div>
            </div>
          </div>
        </section>

        <section class="panel chat-panel">
          <div class="panel-headline">
            <div>
              <div class="panel-kicker">Chat</div>
              <div class="panel-title">房间聊天</div>
            </div>
            <span class="panel-meta">{{ messages.length }} 条</span>
          </div>
          <div ref="messageListRef" class="message-list">
            <div class="message" v-for="message in messages" :key="message.id" :class="message.kind">
              <template v-if="message.kind === 'system'">
                <span>{{ message.content }}</span>
              </template>
              <template v-else>
                <UserAvatar :avatar-id="getMessageAvatarId(message)" :name="message.senderName" :size="34" />
                <div class="message-copy">
                  <strong>{{ message.senderName }}</strong>
                  <span>{{ message.content }}</span>
                </div>
              </template>
            </div>
          </div>
          <div class="chat-input">
            <div class="chat-device-actions">
              <button
                type="button"
                class="device-toggle"
                :class="{ active: isAudioOn, off: !isAudioOn }"
                :aria-pressed="isAudioOn"
                :aria-label="isAudioOn ? '关闭麦克风' : '开启麦克风'"
                :title="isAudioOn ? '关闭麦克风' : '开启麦克风'"
                @click="toggleAudio"
              >
                <svg class="device-toggle-icon" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 14a3 3 0 0 0 3-3V7a3 3 0 1 0-6 0v4a3 3 0 0 0 3 3Z" />
                  <path d="M5 11a7 7 0 0 0 14 0" />
                  <path d="M12 18v3" />
                </svg>
                <span class="sr-only">麦克风</span>
              </button>
              <button
                type="button"
                class="device-toggle"
                :class="{ active: isSpeakerOn, off: !isSpeakerOn }"
                :aria-pressed="isSpeakerOn"
                :aria-label="isSpeakerOn ? '关闭听筒' : '开启听筒'"
                :title="isSpeakerOn ? '关闭听筒' : '开启听筒'"
                @click="toggleSpeaker"
              >
                <svg class="device-toggle-icon" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M5 9v6h4l5 4V5l-5 4H5Z" />
                  <path d="M17 9a4 4 0 0 1 0 6" />
                  <path d="M19 7a7 7 0 0 1 0 10" />
                </svg>
                <span class="sr-only">听筒</span>
              </button>
              <button
                type="button"
                class="device-toggle"
                :class="{ active: isVideoOn, off: !isVideoOn }"
                :aria-pressed="isVideoOn"
                :aria-label="isVideoOn ? '关闭摄像头' : '开启摄像头'"
                :title="isVideoOn ? '关闭摄像头' : '开启摄像头'"
                @click="toggleVideo"
              >
                <svg class="device-toggle-icon" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h7A2.5 2.5 0 0 1 16 8.5v7A2.5 2.5 0 0 1 13.5 18h-7A2.5 2.5 0 0 1 4 15.5v-7Z" />
                  <path d="m16 10 4-2.5v9L16 14" />
                </svg>
                <span class="sr-only">摄像头</span>
              </button>
            </div>
            <input
              v-model="inputMessage"
              class="message-input"
              placeholder="输入消息..."
              @keyup.enter="sendMessage"
            />
            <button class="secondary-btn chat-send-btn" @click="sendMessage">发送</button>
          </div>
        </section>
      </aside>
    </main>

    <div v-if="showWebpageDialog" class="modal-overlay" @click.self="closeWebpageShareDialog">
      <div class="modal-content webpage-dialog">
        <div class="modal-header">
          <h3 class="modal-title">共享网页</h3>
          <button class="modal-close" @click="closeWebpageShareDialog">&times;</button>
        </div>
        <div class="modal-body">
          <label class="input-label" for="webpage-url-input">输入网页地址 (URL)</label>
          <input
            id="webpage-url-input"
            ref="webpageUrlInputRef"
            v-model="webpageUrlInput"
            type="url"
            class="text-input"
            placeholder="https://example.com"
            @keyup.enter="confirmWebpageShare"
          />
          <p class="input-hint">输入要共享的网页地址，房间内所有成员将同步看到该网页内容。</p>
        </div>
        <div class="modal-footer">
          <button class="secondary-btn" @click="closeWebpageShareDialog">取消</button>
          <button class="primary-btn" :disabled="!isValidWebpageUrl" @click="confirmWebpageShare">开始共享</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { io } from 'socket.io-client'
import UserAvatar from '../../components/UserAvatar.vue'
import { createLivekitShareSession } from '../../utils/livekitSession.js'
import { DEFAULT_AVATAR_ID, ensureStoredUserProfile, resolveAvatarId } from '../../utils/userProfile'

const route = useRoute()
const router = useRouter()
const storedUserProfile = ensureStoredUserProfile()

const roomId = ref(String(route.params.roomId || ''))
const requestedAdmin = ref(isRememberedAdminRoom(roomId.value) || route.query.isCreator === 'true')
const displayName = ref(storedUserProfile.displayName)
const avatarId = ref(storedUserProfile.avatarId)
const clientId = getOrCreateClientId()
const socket = ref(null)
const selfId = ref('')
const isConnected = ref(false)
const participants = ref([])
const messages = ref([])
const inputMessage = ref('')
const fileInputRef = ref(null)
const messageListRef = ref(null)
const localVideoRef = ref(null)
const sharedStageRef = ref(null)
const sharedVideoRef = ref(null)
const localMediaStream = ref(null)
const isAudioOn = ref(false)
const isVideoOn = ref(false)
const isSpeakerOn = ref(false)
const activeShare = ref(null)
const currentSharedFile = ref(null)
const pendingStreamShareFile = ref(null)
const hasRequestedLeave = ref(false)
const hasJoinedRoom = ref(false)
const suppressShareEventsUntil = ref(0)

const showWebpageDialog = ref(false)
const webpageUrlInput = ref('')
const webpageShareContainerRef = ref(null)
const webpageUrlInputRef = ref(null)
const webpageLoaded = ref(false)
const webpageIframeLoadState = reactive({})
const sharedVideoMuted = ref(true)
const sharedVideoHasLocalMuteOverride = ref(false)
const sharedVideoLocalPaused = ref(false)
const lastVideoHeartbeatAt = ref(0)
const lastRemotePointerSentAt = ref(0)
const sharedOutgoingStream = ref(null)
const sharedIncomingStream = ref(null)
const remoteControlTargetId = ref('')
const remoteControlAgentStatus = ref('unknown')
const livekitPublisherSession = createLivekitShareSession()
const livekitSubscriberSession = createLivekitShareSession()
const realtimeShareConfig = reactive({ loaded: false, enabled: false, url: '', message: '' })
const showGameMenu = ref(false)
const gameInvite = ref(null)
const activeGame = ref(null)
const selectedGameType = ref('')
const selectedGomokuInviteeId = ref('')
const selectedLandlordInviteeIds = ref([])
const selectedLandlordCardIds = ref([])
const invitePicker = reactive({
  visible: false,
  gameType: '',
  slotIndex: -1
})
const remoteCommandOverlay = reactive({
  visible: false,
  label: '',
  x: 0.5,
  y: 0.5
})
let remoteCommandOverlayTimer = null
let hasShownRemoteAgentHint = false

const peerConnections = reactive({})
const dataChannels = reactive({})
const remoteStreams = reactive({})
const remoteVideoElements = reactive({})
const peerStreamCatalog = reactive({})
const makingOffer = reactive({})
const ignoreOffer = reactive({})
const isSettingRemoteAnswerPending = reactive({})
const incomingTransfers = reactive({})
const pendingBinaryHeaders = reactive({})
const outboundDeliveries = reactive({})
const localTrackSenders = reactive({})
const sharedTrackSenders = reactive({})
const pendingSharedNegotiations = reactive({})
const sharedVideoUi = reactive({
  currentTime: 0,
  duration: 0,
  playing: false,
  muted: true
})
let sharedVideoUiTicker = null
let sharedVideoPlayRequestId = 0
let hasShownSharedVideoAutoplayHint = false
let incomingStreamHealthTicker = null
const incomingStreamHealth = reactive({
  mediaId: '',
  ownerId: '',
  lastFrameCount: 0,
  lastCurrentTime: 0,
  lastProgressAt: 0,
  lastResyncAt: 0
})

if (route.query.isCreator === 'true') {
  rememberAdminRoom(roomId.value)
}

const RTC_CONFIGURATION = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
}
const SHARE_CHUNK_SIZE = 64 * 1024
const DATA_CHANNEL_BUFFER_LIMIT = 1024 * 1024
const VIDEO_PREVIEW_MIN_BYTES = 1024 * 1024
const VIDEO_PREVIEW_UPDATE_BYTES = 1024 * 1024
const VIDEO_PREVIEW_UPDATE_INTERVAL = 800
const STREAM_RESYNC_STALL_MS = 4500
const STREAM_RESYNC_COOLDOWN_MS = 5000
const GOMOKU_BOARD_SIZE = 15
const LANDLORD_REQUIRED_PLAYERS = 3
const LANDLORD_INVITEE_COUNT = LANDLORD_REQUIRED_PLAYERS - 1
const SIGNAL_SERVER_URL = resolveSignalServerUrl()
const REMOTE_CONTROL_AGENT_URL = resolveRemoteControlAgentUrl()

const userCount = computed(() => participants.value.length)
const selfParticipant = computed(() => {
  return participants.value.find((peer) => peer.id === selfId.value) || {
    id: selfId.value,
    name: displayName.value,
    avatarId: avatarId.value
  }
})
const selfAvatarId = computed(() => selfParticipant.value?.avatarId || avatarId.value)
const otherParticipants = computed(() => participants.value.filter((peer) => peer.id !== selfId.value))
const isSuperAdmin = computed(() => participants.value.find((peer) => peer.id === selfId.value)?.isSuperAdmin || false)
const isAdmin = computed(() => participants.value.find((peer) => peer.id === selfId.value)?.isAdmin || false)
const canGrantAdmin = computed(() => isConnected.value && isSuperAdmin.value)
const isRemoteController = computed(() => participants.value.find((peer) => peer.id === selfId.value)?.isController || false)
const isRemoteControlTarget = computed(() => remoteControlTargetId.value === selfId.value)
const hasLocalVideo = computed(() => hasLiveVideoTrack(localMediaStream.value))
const participantsWithVideo = computed(() => {
  return otherParticipants.value.filter((peer) => hasLiveVideoTrack(remoteStreams[peer.id]))
})
const hasVisibleVideoTiles = computed(() => hasLocalVideo.value || participantsWithVideo.value.length > 0)
const isSharingScreen = computed(() => activeShare.value?.kind === 'screen')
const isShareOwner = computed(() => activeShare.value?.ownerId === selfId.value)
const canShare = computed(() => isConnected.value && isAdmin.value)
const canOpenGameMenu = computed(() => isConnected.value && isAdmin.value)
const canGlobalControlShare = computed(() => isConnected.value && isAdmin.value)
const canControlSharedWebpage = computed(() => Boolean(activeShare.value?.kind === 'webpage' && isConnected.value))
const canRefreshSharedWebpage = computed(() => Boolean(canControlSharedWebpage.value && activeShare.value?.url))
const canStepBackwardSharedWebpage = computed(() => canControlSharedWebpage.value && getWebpageHistoryEntries(activeShare.value).length > 1)
const canStepForwardSharedWebpage = computed(() => canControlSharedWebpage.value && getWebpageHistoryEntries(activeShare.value).length > 1)
const canLocalControlSharedVideo = computed(() => Boolean(activeShare.value && activeShare.value.kind === 'video' && isConnected.value))
const canControlShare = computed(() => isConnected.value && (isShareOwner.value || isRemoteController.value))
const canManageSharedMedia = computed(() => isConnected.value && (canControlShare.value || isAdmin.value))
const canCloseGameStage = computed(() => Boolean(canShare.value && (showGameMenu.value || activeGame.value || gameInvite.value)))
const isValidWebpageUrl = computed(() => {
  const url = webpageUrlInput.value.trim()
  if (!url) return false
  try {
    new URL(url)
    return url.startsWith('http://') || url.startsWith('https://')
  } catch {
    return false
  }
})
const remoteControllerName = computed(() => participants.value.find((peer) => peer.isController)?.name || '')
const remoteControlTargetName = computed(() => participants.value.find((peer) => peer.id === remoteControlTargetId.value)?.name || '')
const canRequestRemoteControl = computed(() => {
  return Boolean(
    isConnected.value
    && isSharingScreen.value
    && activeShare.value?.ownerId
    && activeShare.value.ownerId !== selfId.value
    && !isRemoteController.value
  )
})
const canSendRemoteControlCommands = computed(() => {
  return Boolean(
    isConnected.value
    && isRemoteController.value
    && isSharingScreen.value
    && activeShare.value?.ownerId
    && activeShare.value.ownerId !== selfId.value
    && remoteControlTargetId.value === activeShare.value.ownerId
  )
})
const remoteControlHint = computed(() => {
  if (isShareOwner.value && isSharingScreen.value) {
    if (remoteControlAgentStatus.value !== 'ready') {
      return '当前屏幕共享已开启，但共享方本机还没有启动远控执行端，暂时只能看到远控申请。'
    }

    return remoteControllerName.value
      ? `${remoteControllerName.value} 正在远控你的屏幕，可在成员列表中撤销。`
      : '成员可对当前共享屏幕申请远控，需你确认后才会生效。'
  }

  if (isAdmin.value) {
    return remoteControllerName.value
      ? `当前远控成员：${remoteControllerName.value}`
      : '你可以共享文件/屏幕，并给成员授权远程控制共享区。'
  }

  if (isRemoteController.value) {
    return remoteControlTargetName.value
      ? `你正在远控 ${remoteControlTargetName.value} 的共享屏幕，可点击、滚轮和键盘操作共享区。`
      : '你当前拥有远控权限，可控制图片/视频，并在屏幕共享上发送远控指针。'
  }

  if (isRemoteControlTarget.value) {
    return remoteControllerName.value
      ? `${remoteControllerName.value} 已接入你的共享屏幕远控。`
      : '等待远控成员接入。'
  }

  if (canRequestRemoteControl.value && activeShare.value?.ownerName) {
    return `当前正在共享 ${activeShare.value.ownerName} 的屏幕，可申请远控。`
  }

  return '只有房主可以发起共享；当前仅支持对正在共享屏幕的成员申请远控。'
})

function getMeshVideoQualityProfile(peerCount = otherParticipants.value.length) {
  if (peerCount >= 7) {
    return {
      width: 640,
      height: 360,
      frameRate: 12,
      maxBitrate: 500_000
    }
  }

  if (peerCount >= 5) {
    return {
      width: 960,
      height: 540,
      frameRate: 15,
      maxBitrate: 900_000
    }
  }

  if (peerCount >= 3) {
    return {
      width: 1280,
      height: 720,
      frameRate: 20,
      maxBitrate: 1_500_000
    }
  }

  return {
    width: 1920,
    height: 1080,
    frameRate: 24,
    maxBitrate: 2_500_000
  }
}
const gomokuInviteTargets = computed(() => participants.value.filter((peer) => peer.id !== selfId.value))
const landlordInviteTargets = computed(() => participants.value.filter((peer) => peer.id !== selfId.value))
const gameApps = [
  {
    id: 'gomoku',
    name: '五子棋',
    subtitle: '落子在交叉点，先连五子获胜',
    meta: '双人对战'
  },
  {
    id: 'landlord',
    name: '斗地主',
    subtitle: '三人组局，叫分抢地主',
    meta: '三人牌桌'
  }
]
const selectedGomokuPeer = computed(() => {
  return gomokuInviteTargets.value.find((peer) => peer.id === selectedGomokuInviteeId.value) || null
})
const gameInvitees = computed(() => gameInvite.value?.invitees || [])
const myGameInviteEntry = computed(() => gameInvitees.value.find((item) => item.id === selfId.value) || null)
const isPendingInviteForMe = computed(() => myGameInviteEntry.value?.status === 'pending')
const canCancelGameInvite = computed(() => {
  return Boolean(
    gameInvite.value
    && (gameInvite.value.inviterId === selfId.value || myGameInviteEntry.value)
  )
})
const canInviteGomoku = computed(() => {
  return Boolean(
    isConnected.value
    && gomokuInviteTargets.value.length
    && !gameInvite.value
    && !activeGame.value
  )
})
const selectedLandlordPeers = computed(() => {
  const peerMap = new Map(landlordInviteTargets.value.map((peer) => [peer.id, peer]))
  return selectedLandlordInviteeIds.value
    .map((peerId) => peerMap.get(peerId))
    .filter(Boolean)
})
const landlordSeatPeers = computed(() => {
  return Array.from({ length: LANDLORD_INVITEE_COUNT }, (_, index) => selectedLandlordPeers.value[index] || null)
})
const canInviteLandlord = computed(() => {
  return Boolean(
    isConnected.value
    && landlordInviteTargets.value.length >= LANDLORD_INVITEE_COUNT
    && selectedLandlordPeers.value.length === LANDLORD_INVITEE_COUNT
    && !gameInvite.value
    && !activeGame.value
  )
})
const invitePickerTitle = computed(() => {
  if (!invitePicker.visible) {
    return ''
  }

  if (invitePicker.gameType === 'gomoku') {
    return '为五子棋 2 号位选择一位成员'
  }

  if (invitePicker.gameType === 'landlord') {
    return `为斗地主 ${invitePicker.slotIndex === 0 ? '2' : '3'} 号位选择一位成员`
  }

  return ''
})
const invitePickerDescription = computed(() => {
  if (!invitePicker.visible) {
    return ''
  }

  if (invitePicker.gameType === 'gomoku') {
    return '在下方成员列表点击“一键邀请”后，会立即发出五子棋邀请。'
  }

  if (invitePicker.gameType === 'landlord') {
    return '在下方成员列表点击对应按钮后，该成员会被放入当前座位。'
  }

  return ''
})
const invitePickerPeers = computed(() => {
  if (!invitePicker.visible) {
    return []
  }

  if (invitePicker.gameType === 'gomoku') {
    return gomokuInviteTargets.value.filter((peer) => peer.id !== selectedGomokuInviteeId.value)
  }

  if (invitePicker.gameType === 'landlord') {
    const occupiedIds = new Set(
      selectedLandlordInviteeIds.value.filter((peerId, index) => index !== invitePicker.slotIndex)
    )
    return landlordInviteTargets.value.filter((peer) => !occupiedIds.has(peer.id))
  }

  return []
})
const showGameCatalog = computed(() => {
  return Boolean(
    showGameMenu.value
    && !gameInvite.value
    && !activeGame.value
    && !selectedGameType.value
  )
})
const showGameHome = computed(() => {
  return Boolean(
    showGameMenu.value
    && !gameInvite.value
    && !activeGame.value
    && selectedGameType.value
  )
})
const showGameStage = computed(() => Boolean(showGameMenu.value || activeGame.value || gameInvite.value))
const gameMenuButtonLabel = computed(() => {
  if (activeGame.value?.gameType === 'gomoku') {
    return activeGame.value.status === 'playing' ? '棋局中' : '查看棋局'
  }

  if (activeGame.value?.gameType === 'landlord') {
    return activeGame.value.status === 'playing' ? '牌局中' : '查看牌局'
  }

  if (gameInvite.value) {
    return '邀请处理中'
  }

  return showGameMenu.value ? '收起游戏' : '游戏菜单'
})
const gamePanelStatus = computed(() => {
  if (activeGame.value?.gameType === 'gomoku') {
    return activeGame.value.status === 'playing' ? '对局中' : '已结束'
  }

  if (activeGame.value?.gameType === 'landlord') {
    if (activeGame.value.status !== 'playing') {
      return '已结束'
    }

    return activeGame.value.phase === 'bidding' ? '叫分中' : '出牌中'
  }

  if (gameInvite.value) {
    return '邀请处理中'
  }

  return '可发起'
})
const gamePanelSubtitle = computed(() => {
  if (activeGame.value?.gameType === 'gomoku') {
    return '15 x 15 棋盘，黑子先手，房间内实时同步对局。'
  }

  if (activeGame.value?.gameType === 'landlord') {
    return '三人叫分抢地主，手牌、叫分和出牌顺序都由服务端同步裁定。'
  }

  if (selectedGameType.value === 'gomoku') {
    return '点击空位上的 + 后，可在右侧成员列表一键发起五子棋邀请。'
  }

  if (selectedGameType.value === 'landlord') {
    return '先点击空位上的 +，再在右侧成员列表选择两位成员组局。'
  }

  return '选择房间成员发起邀请，在房间内同步进行对局。'
})
const gameInviteBannerTitle = computed(() => {
  if (!gameInvite.value) {
    return ''
  }

  if (isPendingInviteForMe.value) {
    return `${gameInvite.value.inviterName} 邀请你加入一局${getGameTypeLabel(gameInvite.value.gameType)}`
  }

  if (gameInvite.value.inviterId === selfId.value) {
    return `已向 ${formatGameInviteeNames(gameInvitees.value)} 发起${getGameTypeLabel(gameInvite.value.gameType)}邀请`
  }

  return `${gameInvite.value.inviterName} 正在组一局${getGameTypeLabel(gameInvite.value.gameType)}`
})
const gameInviteBannerText = computed(() => {
  if (!gameInvite.value) {
    return ''
  }

  const acceptedCount = gameInvitees.value.filter((item) => item.status === 'accepted').length

  return isPendingInviteForMe.value
    ? `接受后会在当前房间内开始一局新的${getGameTypeLabel(gameInvite.value.gameType)}。`
    : `已接受 ${acceptedCount}/${gameInvitees.value.length} 人，全部同意后会自动开始。`
})
const gomokuBoard = computed(() => activeGame.value?.gameType === 'gomoku' ? (activeGame.value.board || []) : [])
const isPlayingGomoku = computed(() => {
  return Boolean(
    activeGame.value?.gameType === 'gomoku'
    && [activeGame.value.blackId, activeGame.value.whiteId].includes(selfId.value)
  )
})
const myGomokuStone = computed(() => {
  if (!activeGame.value) {
    return ''
  }
  if (activeGame.value.blackId === selfId.value) return 'black'
  if (activeGame.value.whiteId === selfId.value) return 'white'
  return ''
})
const isMyGomokuTurn = computed(() => activeGame.value?.currentTurnId === selfId.value)
const canCloseActiveGame = computed(() => {
  return Boolean(
    isConnected.value
    && activeGame.value
    && activeGame.value.status === 'finished'
  )
})
const gomokuWinningCellSet = computed(() => {
  return new Set((activeGame.value?.winningLine || []).map((cell) => `${cell.row}:${cell.col}`))
})
const gomokuStatusText = computed(() => {
  if (!activeGame.value) {
    return ''
  }

  if (activeGame.value.status === 'playing') {
    if (isMyGomokuTurn.value) {
      return `轮到你落子（${myGomokuStone.value === 'black' ? '黑子' : '白子'}）`
    }

    const currentName = activeGame.value.currentTurnId === activeGame.value.blackId
      ? activeGame.value.blackName
      : activeGame.value.whiteName
    return `轮到 ${currentName} 落子`
  }

  if (activeGame.value.endedReason === 'draw') {
    return '本局平手'
  }

  if (activeGame.value.winnerName) {
    return `${activeGame.value.winnerName} 获胜`
  }

  return '本局已结束'
})
const gomokuStatusSubtext = computed(() => {
  if (!activeGame.value) {
    return ''
  }

  if (activeGame.value.status === 'playing') {
    return activeGame.value.lastMove
      ? `最近一步：${activeGame.value.lastMove.playerName} 落在 ${activeGame.value.lastMove.row + 1}, ${activeGame.value.lastMove.col + 1}`
      : '黑子先手，点击棋盘空位即可落子。'
  }

  if (activeGame.value.endedReason === 'resign') {
    return '一方认输，本局结束。'
  }

  if (activeGame.value.endedReason === 'player-left') {
    return '有对局成员离开房间，本局自动结束。'
  }

  if (activeGame.value.endedReason === 'draw') {
    return '棋盘已下满，双方战平。'
  }

  return '你可以收起棋盘，继续在房间内聊天或共享。'
})
const isLandlordGame = computed(() => activeGame.value?.gameType === 'landlord')
const isLandlordParticipant = computed(() => {
  return Boolean(activeGame.value?.players?.some((player) => player.id === selfId.value))
})
const myLandlordHand = computed(() => {
  return isLandlordGame.value ? (activeGame.value.myHand || []) : []
})
const selectedLandlordCards = computed(() => {
  const selectedIdSet = new Set(selectedLandlordCardIds.value)
  return myLandlordHand.value.filter((card) => selectedIdSet.has(card.id))
})
const canBidLandlord = computed(() => {
  return Boolean(
    isLandlordGame.value
    && activeGame.value.status === 'playing'
    && activeGame.value.phase === 'bidding'
    && activeGame.value.currentBidderId === selfId.value
  )
})
const landlordBidOptions = computed(() => {
  const highestBid = Number(activeGame.value?.highestBid || 0)
  return [0, 1, 2, 3].filter((score) => score === 0 || score > highestBid)
})
const canInteractLandlordHand = computed(() => {
  return Boolean(
    isLandlordParticipant.value
    && activeGame.value?.status === 'playing'
    && activeGame.value?.phase === 'playing'
    && activeGame.value.currentTurnId === selfId.value
  )
})
const canPlayLandlordCards = computed(() => Boolean(canInteractLandlordHand.value && selectedLandlordCards.value.length))
const canPassLandlordTurn = computed(() => {
  return Boolean(
    canInteractLandlordHand.value
    && activeGame.value?.currentTrick
    && activeGame.value.currentTrick.playerId !== selfId.value
  )
})
const landlordStatusText = computed(() => {
  if (!isLandlordGame.value) {
    return ''
  }

  if (activeGame.value.status === 'finished') {
    if (activeGame.value.winningSide === 'landlord') {
      return `${activeGame.value.landlordName || '地主'} 方获胜`
    }

    if (activeGame.value.winningSide === 'farmers') {
      return `${formatNameList(activeGame.value.winnerNames || []) || '农民'} 获胜`
    }

    return activeGame.value.winnerName ? `${activeGame.value.winnerName} 获胜` : '本局已结束'
  }

  if (activeGame.value.phase === 'bidding') {
    const currentName = activeGame.value.players?.find((player) => player.id === activeGame.value.currentBidderId)?.name || '房间成员'
    return activeGame.value.currentBidderId === selfId.value
      ? '轮到你叫分'
      : `轮到 ${currentName} 叫分`
  }

  const currentName = activeGame.value.players?.find((player) => player.id === activeGame.value.currentTurnId)?.name || '房间成员'
  return activeGame.value.currentTurnId === selfId.value
    ? '轮到你出牌'
    : `轮到 ${currentName} 出牌`
})
const landlordStatusSubtext = computed(() => {
  if (!isLandlordGame.value) {
    return ''
  }

  if (activeGame.value.status === 'finished') {
    if (activeGame.value.endedReason === 'player-left') {
      return '有对局成员离开房间，本局自动结束。'
    }

    if (activeGame.value.winningSide === 'landlord') {
      return '地主率先出完手牌，牌局结束。'
    }

    if (activeGame.value.winningSide === 'farmers') {
      return '农民方率先出完手牌，牌局结束。'
    }

    return '本局结束，你可以关闭游戏窗口返回共享区。'
  }

  if (activeGame.value.phase === 'bidding') {
    return `当前最高叫分 ${Math.max(Number(activeGame.value.highestBid || 0), 0)} 分。`
  }

  if (activeGame.value.currentTrick) {
    return `${activeGame.value.currentTrick.playerName} 刚出了 ${activeGame.value.currentTrick.combination?.label || '一手牌'}。`
  }

  return '地主先出牌，同轮其余玩家需要压过上家或选择不要。'
})
const landlordBidWaitingText = computed(() => {
  if (!isLandlordGame.value || activeGame.value.phase !== 'bidding') {
    return ''
  }

  const currentName = activeGame.value.players?.find((player) => player.id === activeGame.value.currentBidderId)?.name || '房间成员'
  return activeGame.value.currentBidderId === selfId.value
    ? '请选择叫分。'
    : `等待 ${currentName} 叫分。`
})
const shareStatusText = computed(() => {
  const share = activeShare.value
  if (!share) {
    return ''
  }

  if (isVideoLikeShare(share) && share.deliveryMode === 'stream' && share.ownerId !== selfId.value && !sharedIncomingStream.value) {
    return `正在接入实时${share.kind === 'screen' ? '屏幕流' : '视频流'}`
  }

  if (share.isReceiving) {
    return `接收进度 ${Math.round(share.progress || 0)}%`
  }

  if (share.kind === 'screen') {
    return remoteControllerName.value
      ? `正在实时共享屏幕，${remoteControllerName.value} 可远控`
      : '正在实时共享屏幕'
  }

  if (share.ownerId === selfId.value && otherParticipants.value.length > 0) {
    const doneCount = otherParticipants.value.filter((peer) => {
      return outboundDeliveries[deliveryKey(peer.id, share.id)] === 'done'
    }).length
    return `已同步给 ${doneCount}/${otherParticipants.value.length} 位成员`
  }

  if (share.kind === 'video' && share.sync) {
    return share.deliveryMode === 'stream'
      ? (share.sync.playing ? '正在实时同步播放' : '实时流已暂停')
      : (share.sync.playing ? '正在同步播放' : '当前为暂停状态')
  }

  return '点击图片可同步放大或还原'
})

function resolveSignalServerUrl() {
  if (import.meta.env.VITE_SIGNAL_SERVER_URL) {
    return import.meta.env.VITE_SIGNAL_SERVER_URL
  }
  if (window.location.port === '3001') {
    return window.location.origin
  }
  return window.location.origin
}

function resolveRemoteControlAgentUrl() {
  if (import.meta.env.VITE_REMOTE_CONTROL_AGENT_URL) {
    return import.meta.env.VITE_REMOTE_CONTROL_AGENT_URL
  }

  return 'http://127.0.0.1:7788'
}

function getRememberedAdminRooms() {
  try {
    return JSON.parse(sessionStorage.getItem('shareroom-admin-rooms') || '[]')
  } catch (error) {
    return []
  }
}

function rememberAdminRoom(targetRoomId) {
  try {
    const rooms = new Set(getRememberedAdminRooms())
    rooms.add(targetRoomId)
    sessionStorage.setItem('shareroom-admin-rooms', JSON.stringify([...rooms]))
  } catch (error) {
    console.error('保存管理员房间失败:', error)
  }
}

function forgetAdminRoom(targetRoomId) {
  try {
    const rooms = getRememberedAdminRooms().filter((item) => item !== targetRoomId)
    sessionStorage.setItem('shareroom-admin-rooms', JSON.stringify(rooms))
  } catch (error) {
    console.error('移除管理员房间失败:', error)
  }
}

function isRememberedAdminRoom(targetRoomId) {
  return getRememberedAdminRooms().includes(targetRoomId)
}

function supportsStreamVideoShare() {
  if (typeof document === 'undefined') {
    return false
  }

  const element = document.createElement('video')
  return typeof element.captureStream === 'function' || typeof element.mozCaptureStream === 'function'
}

function getOrCreateClientId() {
  try {
    const storageKey = 'shareroom-client-id'
    const saved = sessionStorage.getItem(storageKey)
    if (saved) {
      return saved
    }
    const nextId = createId('client_')
    sessionStorage.setItem(storageKey, nextId)
    return nextId
  } catch (error) {
    return createId('client_')
  }
}

function createId(prefix = '') {
  const value = globalThis.crypto?.randomUUID?.() || `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
  return prefix ? `${prefix}${value}` : value
}

function formatBytes(bytes = 0) {
  if (!bytes) {
    return '0 B'
  }
  const units = ['B', 'KB', 'MB', 'GB']
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const size = bytes / (1024 ** index)
  return `${size >= 10 || index === 0 ? size.toFixed(0) : size.toFixed(1)} ${units[index]}`
}

function formatDuration(seconds = 0) {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return '00:00'
  }

  const totalSeconds = Math.max(0, Math.floor(seconds))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const secs = totalSeconds % 60

  if (hours > 0) {
    return [hours, minutes, secs].map((value) => String(value).padStart(2, '0')).join(':')
  }

  return [minutes, secs].map((value) => String(value).padStart(2, '0')).join(':')
}

function deliveryKey(peerId, mediaId) {
  return `${peerId}:${mediaId}`
}

function transferKey(peerId, mediaId) {
  return `${peerId}:${mediaId}`
}

function hasParticipant(peerId) {
  return participants.value.some((peer) => peer.id === peerId)
}

function hasIncompleteIncomingTransfer(peerId, mediaId = activeShare.value?.id) {
  if (!peerId || !mediaId) {
    return false
  }

  return Boolean(incomingTransfers[transferKey(peerId, mediaId)])
}

function getParticipantName(peerId) {
  return participants.value.find((peer) => peer.id === peerId)?.name || '房间成员'
}

function getParticipantAvatarId(peerId) {
  return resolveAvatarId(participants.value.find((peer) => peer.id === peerId)?.avatarId || DEFAULT_AVATAR_ID)
}

function getMessageAvatarId(message) {
  if (message?.senderAvatarId) {
    return resolveAvatarId(message.senderAvatarId)
  }

  if (message?.senderId) {
    return getParticipantAvatarId(message.senderId)
  }

  return DEFAULT_AVATAR_ID
}

function shouldCreateInitialDataChannel(peerId) {
  return Boolean(selfId.value) && selfId.value < peerId
}

function isPolitePeer(peerId) {
  return Boolean(selfId.value) && selfId.value > peerId
}

function isStreamShare(share = activeShare.value) {
  return Boolean(share && share.deliveryMode === 'stream' && ['video', 'screen'].includes(share.kind))
}

function isVideoLikeShare(share = activeShare.value) {
  return Boolean(share && ['video', 'screen'].includes(share.kind))
}

function shouldUseSyncedVideoUi(share = activeShare.value) {
  return Boolean(share && share.kind === 'video' && isStreamShare(share) && share.ownerId !== selfId.value)
}

function getShareKindLabel(kind) {
  if (kind === 'image') return '图片'
  if (kind === 'screen') return '屏幕'
  if (kind === 'webpage') return '网页'
  return '视频'
}

function getSharedVideoSource(share = activeShare.value) {
  if (!share || share.kind !== 'video') {
    return undefined
  }
  if (share.deliveryMode === 'stream' && share.ownerId !== selfId.value) {
    return undefined
  }
  return share.url || undefined
}

function getShareBadgeTitle(share = activeShare.value) {
  if (!share) {
    return ''
  }

  const fileName = typeof share?.fileName === 'string' ? share.fileName.trim() : ''
  const ownerName = share?.ownerName || '管理员'
  const kindLabel = getShareKindLabel(share?.kind)

  return fileName ? `${ownerName} 共享了${kindLabel}：${fileName}` : `${ownerName} 共享了${kindLabel}`
}

function truncateTextWithEllipsis(text, maxLength) {
  const glyphs = Array.from(String(text || ''))
  if (!Number.isFinite(maxLength) || maxLength < 1 || glyphs.length <= maxLength) {
    return glyphs.join('')
  }

  return glyphs.slice(0, maxLength).join('') + '...'
}

function getSharedOverviewTitle() {
  if (showGameStage.value) {
    return activeGame.value ? '房内对局进行中' : '互动菜单已展开'
  }

  if (activeShare.value?.fileName) {
    return activeShare.value.fileName
  }

  return '共享舞台待命中'
}

function getSharedOverviewDisplayTitle() {
  return truncateTextWithEllipsis(getSharedOverviewTitle(), 24)
}

function getShareBadgeDisplayTitle(share = activeShare.value) {
  const maxLength = share?.kind === 'webpage' ? 24 : 20
  return truncateTextWithEllipsis(getShareBadgeTitle(share), maxLength)
}

function shouldMuteSharedVideo(share = activeShare.value) {
  if (!share || !isVideoLikeShare(share)) {
    return true
  }
  return sharedVideoMuted.value
}

function toggleSharedVideoMute() {
  sharedVideoMuted.value = !sharedVideoMuted.value
  if (!canGlobalControlShare.value) {
    sharedVideoHasLocalMuteOverride.value = true
  }
  sharedVideoUi.muted = sharedVideoMuted.value
  if (sharedVideoRef.value) {
    sharedVideoRef.value.muted = sharedVideoMuted.value
  }

  if (canGlobalControlShare.value && activeShare.value?.kind === 'video') {
    emitShareControl('mute', {
      muted: sharedVideoMuted.value,
      playing: sharedVideoUi.playing,
      currentTime: sharedVideoUi.currentTime,
      duration: sharedVideoUi.duration
    })
  }
}

function toggleSharedStageFullscreen() {
  const stage = sharedStageRef.value
  if (!stage) return

  if (document.fullscreenElement) {
    document.exitFullscreen()
  } else {
    stage.requestFullscreen().catch(() => {
      pushSystemMessage('全屏模式不可用')
    })
  }
}

function toggleSharedVideoFullscreen() {
  toggleSharedStageFullscreen()
}

function toggleSharedWebpageFullscreen() {
  const container = webpageShareContainerRef.value || sharedStageRef.value
  if (!container) {
    return
  }

  if (document.fullscreenElement) {
    document.exitFullscreen()
  } else {
    container.requestFullscreen().catch(() => {
      pushSystemMessage('全屏模式不可用')
    })
  }
}

function suppressShareEvents(duration = 700) {
  suppressShareEventsUntil.value = Date.now() + duration
}

function shouldSuppressShareEvents() {
  return Date.now() < suppressShareEventsUntil.value
}

function cancelSharedVideoPlayRequest() {
  sharedVideoPlayRequestId += 1
}

function handleSharedVideoPlayError(error, options = {}) {
  const { source = '共享视频播放', silentAbort = true } = options

  if (error?.name === 'AbortError') {
    if (!silentAbort) {
      console.warn(`${source}已被新的播放状态打断`)
    }
    return false
  }

  if (error?.name === 'NotAllowedError') {
    if (!hasShownSharedVideoAutoplayHint) {
      pushSystemMessage('浏览器阻止了自动播放，已自动静音重试；如仍未播放，请点击播放按钮继续')
      hasShownSharedVideoAutoplayHint = true
    }
    return false
  }

  console.error(`${source}失败:`, error)
  return false
}

async function playSharedVideoSafely(options = {}) {
  const { source = '共享视频播放', force = false } = options
  const video = sharedVideoRef.value
  if (!video) {
    return false
  }

  if (!force && !video.paused && !video.ended) {
    return true
  }

  const requestId = ++sharedVideoPlayRequestId

  try {
    await video.play()
    return true
  } catch (error) {
    if (requestId !== sharedVideoPlayRequestId && error?.name === 'AbortError') {
      return false
    }

    if (error?.name === 'NotAllowedError' && !video.muted) {
      video.muted = true
      sharedVideoMuted.value = true
      sharedVideoUi.muted = true
      sharedVideoHasLocalMuteOverride.value = true
      return video.play()
        .then(() => true)
        .catch((retryError) => handleSharedVideoPlayError(retryError, { source, silentAbort: true }))
    }

    return handleSharedVideoPlayError(error, { source, silentAbort: true })
  }
}

function isPeerConnected(peerId) {
  if (peerId === selfId.value) {
    return true
  }
  return dataChannels[peerId]?.readyState === 'open' || peerConnections[peerId]?.connectionState === 'connected'
}

function scrollMessagesToBottom() {
  if (messageListRef.value) {
    messageListRef.value.scrollTo({
      top: messageListRef.value.scrollHeight,
      behavior: 'smooth'
    })
  }
}

function pushMessage(message) {
  messages.value.push({
    id: message.id || createId('msg_'),
    timestamp: message.timestamp || Date.now(),
    ...message
  })
  nextTick(scrollMessagesToBottom)
}

function pushSystemMessage(content) {
  pushMessage({
    kind: 'system',
    content
  })
}

function getResolvedSharedVideoDuration(sync = activeShare.value?.sync) {
  const syncedDuration = Number(sync?.duration)
  if (Number.isFinite(syncedDuration) && syncedDuration > 0) {
    return syncedDuration
  }

  const elementDuration = Number(sharedVideoRef.value?.duration)
  if (Number.isFinite(elementDuration) && elementDuration > 0) {
    return elementDuration
  }

  const sharedDuration = Number(activeShare.value?.duration)
  if (Number.isFinite(sharedDuration) && sharedDuration > 0) {
    return sharedDuration
  }

  return 0
}

function syncSharedVideoUiFromState(sync = activeShare.value?.sync) {
  if (!sync) {
    sharedVideoUi.currentTime = 0
    sharedVideoUi.duration = 0
    sharedVideoUi.playing = false
    sharedVideoUi.muted = true
    sharedVideoMuted.value = true
    sharedVideoHasLocalMuteOverride.value = false
    return
  }

  const nextCurrentTime = shouldUseSyncedVideoUi()
    ? getVideoSyncTime(sync)
    : Number(sync.currentTime || 0)
  sharedVideoUi.currentTime = !canGlobalControlShare.value && sharedVideoLocalPaused.value
    ? Number(sharedVideoRef.value?.currentTime || sharedVideoUi.currentTime || 0)
    : nextCurrentTime
  sharedVideoUi.duration = getResolvedSharedVideoDuration(sync)
  sharedVideoUi.playing = !canGlobalControlShare.value && sharedVideoLocalPaused.value
    ? false
    : Boolean(sync.playing)
  const syncedMuted = Boolean(sync.muted ?? true)
  if (canGlobalControlShare.value || !sharedVideoHasLocalMuteOverride.value) {
    sharedVideoMuted.value = syncedMuted
  }
  sharedVideoUi.muted = canGlobalControlShare.value ? syncedMuted : sharedVideoMuted.value
  if (sharedVideoRef.value) {
    sharedVideoRef.value.muted = sharedVideoMuted.value
  }
}

function restartSharedVideoUiTicker() {
  if (sharedVideoUiTicker) {
    clearInterval(sharedVideoUiTicker)
    sharedVideoUiTicker = null
  }

  if (!shouldUseSyncedVideoUi() || !activeShare.value?.sync?.playing || (!canGlobalControlShare.value && sharedVideoLocalPaused.value)) {
    return
  }

  sharedVideoUiTicker = window.setInterval(() => {
    if (!shouldUseSyncedVideoUi() || !activeShare.value?.sync) {
      return
    }
    syncSharedVideoUiFromState(activeShare.value.sync)
  }, 250)
}

function resetIncomingStreamHealthState() {
  incomingStreamHealth.mediaId = ''
  incomingStreamHealth.ownerId = ''
  incomingStreamHealth.lastFrameCount = 0
  incomingStreamHealth.lastCurrentTime = 0
  incomingStreamHealth.lastProgressAt = 0
  incomingStreamHealth.lastResyncAt = 0
}

function markIncomingStreamHealthy(video = sharedVideoRef.value) {
  if (!video) {
    return
  }

  const frameCount = Number(video.getVideoPlaybackQuality?.().totalVideoFrames || video.webkitDecodedFrameCount || 0)
  const currentTime = Number(video.currentTime || 0)
  incomingStreamHealth.lastFrameCount = frameCount
  incomingStreamHealth.lastCurrentTime = currentTime
  incomingStreamHealth.lastProgressAt = Date.now()
}

function restartIncomingStreamHealthMonitor() {
  if (incomingStreamHealthTicker) {
    clearInterval(incomingStreamHealthTicker)
    incomingStreamHealthTicker = null
  }

  if (
    !activeShare.value
    || !isStreamShare(activeShare.value)
    || activeShare.value.ownerId === selfId.value
  ) {
    resetIncomingStreamHealthState()
    return
  }

  incomingStreamHealth.mediaId = activeShare.value.id
  incomingStreamHealth.ownerId = activeShare.value.ownerId
  incomingStreamHealth.lastProgressAt = Date.now()

  incomingStreamHealthTicker = window.setInterval(() => {
    const share = activeShare.value
    const video = sharedVideoRef.value
    if (
      !share
      || !video
      || !isStreamShare(share)
      || share.ownerId === selfId.value
      || share.id !== incomingStreamHealth.mediaId
    ) {
      return
    }

    const frameCount = Number(video.getVideoPlaybackQuality?.().totalVideoFrames || video.webkitDecodedFrameCount || 0)
    const currentTime = Number(video.currentTime || 0)
    const advanced = frameCount > incomingStreamHealth.lastFrameCount || currentTime > incomingStreamHealth.lastCurrentTime + 0.12

    if (advanced) {
      incomingStreamHealth.lastFrameCount = frameCount
      incomingStreamHealth.lastCurrentTime = currentTime
      incomingStreamHealth.lastProgressAt = Date.now()
      return
    }

    const now = Date.now()
    if (
      now - incomingStreamHealth.lastProgressAt >= STREAM_RESYNC_STALL_MS
      && now - incomingStreamHealth.lastResyncAt >= STREAM_RESYNC_COOLDOWN_MS
    ) {
      incomingStreamHealth.lastResyncAt = now
      tryBindSharedIncomingStream(share.ownerId)
      syncSharedVideoElementSource()
      requestShareSync(activeShare.value.id)
    }
  }, 1500)
}

function getRemotePointerStyle(pointer) {
  return {
    left: `${Math.min(Math.max(pointer.x || 0, 0), 1) * 100}%`,
    top: `${Math.min(Math.max(pointer.y || 0, 0), 1) * 100}%`
  }
}

function clearRemoteCommandOverlay() {
  remoteCommandOverlay.visible = false
  remoteCommandOverlay.label = ''

  if (remoteCommandOverlayTimer) {
    clearTimeout(remoteCommandOverlayTimer)
    remoteCommandOverlayTimer = null
  }
}

function formatRemoteKey(command) {
  const parts = []
  if (command?.ctrlKey) parts.push('Ctrl')
  if (command?.shiftKey) parts.push('Shift')
  if (command?.altKey) parts.push('Alt')
  if (command?.metaKey) parts.push('Meta')
  if (command?.key) parts.push(command.key === ' ' ? 'Space' : command.key)
  return parts.join('+')
}

function showRemoteCommandOverlay(command, senderName = '') {
  const actorName = senderName || '远控成员'
  let label = `${actorName} 正在操作`

  if (command?.type === 'click') {
    label = `${actorName} 点击了屏幕`
  } else if (command?.type === 'double-click') {
    label = `${actorName} 双击了屏幕`
  } else if (command?.type === 'contextmenu') {
    label = `${actorName} 触发了右键`
  } else if (command?.type === 'wheel') {
    label = `${actorName} 正在滚动屏幕`
  } else if (command?.type === 'keydown' && command?.key) {
    label = `${actorName} 按下 ${formatRemoteKey(command)}`
  }

  remoteCommandOverlay.visible = true
  remoteCommandOverlay.label = label
  remoteCommandOverlay.x = Math.min(Math.max(command?.x ?? activeShare.value?.pointer?.x ?? 0.5, 0), 1)
  remoteCommandOverlay.y = Math.min(Math.max(command?.y ?? activeShare.value?.pointer?.y ?? 0.5, 0), 1)

  if (remoteCommandOverlayTimer) {
    clearTimeout(remoteCommandOverlayTimer)
  }

  remoteCommandOverlayTimer = window.setTimeout(() => {
    remoteCommandOverlay.visible = false
  }, 1600)
}

function setRemoteControlState(controllerId = '', targetId = '') {
  remoteControlTargetId.value = targetId || ''

  if (!controllerId) {
    clearRemoteCommandOverlay()
  }
}

function formatNameList(names = []) {
  return names.filter(Boolean).join('、')
}

function getGameTypeLabel(gameType) {
  if (gameType === 'landlord') {
    return '斗地主'
  }

  return '五子棋'
}

function formatGameInviteeNames(invitees = []) {
  return formatNameList(invitees.map((item) => item.name))
}

function getLandlordPlayerRoleLabel(player) {
  return player?.role === 'landlord' ? '地主' : '农民'
}

function getLandlordCardLabel(card) {
  return card?.label || card?.rank || '?'
}

function getLandlordCardSuitLabel(card) {
  if (card?.suit === 'S') return 'S'
  if (card?.suit === 'H') return 'H'
  if (card?.suit === 'C') return 'C'
  if (card?.suit === 'D') return 'D'
  return 'J'
}

function isLandlordRedCard(card) {
  return ['H', 'D', 'J'].includes(card?.suit)
}

function cloneGameInvite(invite) {
  return invite
    ? {
        ...invite,
        invitees: (invite.invitees || []).map((item) => ({ ...item }))
      }
    : null
}

function cloneGameState(gameState) {
  if (!gameState) {
    return null
  }

  if (gameState.gameType === 'gomoku') {
    return {
      ...gameState,
      board: (gameState.board || []).map((row) => [...row]),
      winningLine: (gameState.winningLine || []).map((item) => ({ ...item })),
      lastMove: gameState.lastMove ? { ...gameState.lastMove } : null
    }
  }

  if (gameState.gameType === 'landlord') {
    return {
      ...gameState,
      players: (gameState.players || []).map((player) => ({ ...player })),
      myHand: (gameState.myHand || []).map((card) => ({ ...card })),
      bottomCards: (gameState.bottomCards || []).map((card) => ({ ...card })),
      bidHistory: (gameState.bidHistory || []).map((item) => ({ ...item })),
      winnerIds: [...(gameState.winnerIds || [])],
      winnerNames: [...(gameState.winnerNames || [])],
      currentTrick: gameState.currentTrick
        ? {
            ...gameState.currentTrick,
            cards: (gameState.currentTrick.cards || []).map((card) => ({ ...card })),
            combination: gameState.currentTrick.combination ? { ...gameState.currentTrick.combination } : null
          }
        : null,
      lastAction: gameState.lastAction
        ? {
            ...gameState.lastAction,
            cards: (gameState.lastAction.cards || []).map((card) => ({ ...card })),
            combination: gameState.lastAction.combination ? { ...gameState.lastAction.combination } : null
          }
        : null
    }
  }

  return { ...gameState }
}

function setGameInvite(nextInvite) {
  gameInvite.value = cloneGameInvite(nextInvite)
  if (gameInvite.value) {
    showGameMenu.value = true
    closeInvitePicker()
  } else if (!activeGame.value) {
    selectedLandlordInviteeIds.value = []
  }
}

function setGameState(nextGameState) {
  activeGame.value = cloneGameState(nextGameState)
  if (activeGame.value) {
    showGameMenu.value = true
    closeInvitePicker()
  } else {
    selectedLandlordCardIds.value = []
  }
}

function toggleGameMenu() {
  const nextVisible = !showGameMenu.value
  showGameMenu.value = nextVisible

  if (nextVisible && !gameInvite.value && !activeGame.value) {
    selectedGameType.value = ''
  }

  if (!showGameMenu.value && !gameInvite.value && !activeGame.value) {
    closeInvitePicker()
    selectedGomokuInviteeId.value = ''
    selectedLandlordInviteeIds.value = []
    selectedGameType.value = ''
  }
}

function openGameHome(gameType) {
  if (!showGameMenu.value || gameInvite.value || activeGame.value) {
    return
  }

  selectedGameType.value = gameType
  if (gameType !== 'landlord') {
    selectedLandlordInviteeIds.value = []
  }
}

function backToGameCatalog() {
  closeInvitePicker()
  selectedGameType.value = ''
  selectedGomokuInviteeId.value = ''
  selectedLandlordInviteeIds.value = []
}

function openInvitePicker(gameType, slotIndex = 0) {
  if (!showGameMenu.value || gameInvite.value || activeGame.value) {
    return
  }

  selectedGameType.value = gameType
  invitePicker.visible = true
  invitePicker.gameType = gameType
  invitePicker.slotIndex = slotIndex
}

function closeInvitePicker() {
  invitePicker.visible = false
  invitePicker.gameType = ''
  invitePicker.slotIndex = -1
}

function selectPeerForInvite(peer) {
  if (!peer?.id || !invitePicker.visible) {
    return
  }

  if (invitePicker.gameType === 'gomoku') {
    selectedGomokuInviteeId.value = peer.id
    closeInvitePicker()
    inviteToGomoku(peer)
    return
  }

  if (invitePicker.gameType === 'landlord') {
    const nextIds = [...selectedLandlordInviteeIds.value]
    nextIds[invitePicker.slotIndex] = peer.id

    const compactUniqueIds = []
    for (const peerId of nextIds) {
      if (peerId && !compactUniqueIds.includes(peerId)) {
        compactUniqueIds.push(peerId)
      }
    }

    selectedLandlordInviteeIds.value = compactUniqueIds.slice(0, LANDLORD_INVITEE_COUNT)
    closeInvitePicker()
  }
}

function canInvitePeerFromList(peer) {
  if (!peer?.id || !invitePicker.visible) {
    return false
  }

  return invitePickerPeers.value.some((candidate) => candidate.id === peer.id)
}

function getInvitePeerActionLabel() {
  if (invitePicker.gameType === 'gomoku') {
    return '一键邀请'
  }

  if (invitePicker.gameType === 'landlord') {
    return `加入 ${invitePicker.slotIndex === 0 ? '2' : '3'} 号位`
  }

  return '邀请'
}

function getParticipantSeatLabel(peerId) {
  if (!peerId) {
    return ''
  }

  if (selectedGameType.value === 'gomoku' && selectedGomokuInviteeId.value === peerId) {
    return '五子棋 · 2 号位'
  }

  if (selectedGameType.value === 'landlord') {
    const landlordSeatIndex = selectedLandlordInviteeIds.value.indexOf(peerId)
    if (landlordSeatIndex !== -1) {
      return `斗地主 · ${landlordSeatIndex + 2} 号位`
    }
  }

  return ''
}

function clearGomokuInvitee() {
  selectedGomokuInviteeId.value = ''
  if (invitePicker.gameType === 'gomoku') {
    closeInvitePicker()
  }
}

function removeLandlordInviteeAt(index) {
  const nextIds = [...selectedLandlordInviteeIds.value]
  nextIds.splice(index, 1)
  selectedLandlordInviteeIds.value = nextIds

  if (invitePicker.gameType === 'landlord') {
    closeInvitePicker()
  }
}

function canSelectLandlordPeer(peerId) {
  return Boolean(
    !gameInvite.value
    && !activeGame.value
    && (
      selectedLandlordInviteeIds.value.includes(peerId)
      || selectedLandlordInviteeIds.value.length < LANDLORD_INVITEE_COUNT
    )
  )
}

function toggleLandlordInvitee(peerId) {
  if (!canSelectLandlordPeer(peerId)) {
    return
  }

  if (selectedLandlordInviteeIds.value.includes(peerId)) {
    selectedLandlordInviteeIds.value = selectedLandlordInviteeIds.value.filter((item) => item !== peerId)
    return
  }

  selectedLandlordInviteeIds.value = [...selectedLandlordInviteeIds.value, peerId].slice(0, LANDLORD_INVITEE_COUNT)
}

function clearSelectedLandlordCards() {
  selectedLandlordCardIds.value = []
}

function toggleLandlordCard(cardId) {
  if (!canInteractLandlordHand.value) {
    return
  }

  if (selectedLandlordCardIds.value.includes(cardId)) {
    selectedLandlordCardIds.value = selectedLandlordCardIds.value.filter((item) => item !== cardId)
    return
  }

  selectedLandlordCardIds.value = [...selectedLandlordCardIds.value, cardId]
}

function isWinningGomokuCell(row, col) {
  return gomokuWinningCellSet.value.has(`${row}:${col}`)
}

function canPlaceGomokuStone(row, col) {
  return Boolean(
    activeGame.value
    && activeGame.value.status === 'playing'
    && isPlayingGomoku.value
    && isMyGomokuTurn.value
    && !activeGame.value.board?.[row]?.[col]
  )
}

async function checkRemoteControlAgent(options = {}) {
  const { quiet = false } = options

  try {
    const response = await fetch(`${REMOTE_CONTROL_AGENT_URL}/health`)
    if (!response.ok) {
      throw new Error(`health-${response.status}`)
    }

    const payload = await response.json()
    remoteControlAgentStatus.value = payload.dependencyReady ? 'ready' : 'dependency-missing'

    if (!quiet && remoteControlAgentStatus.value !== 'ready' && !hasShownRemoteAgentHint) {
      hasShownRemoteAgentHint = true
      pushSystemMessage('共享方本机未准备好远控执行端，请先执行 `npm run remote-agent` 并安装 agent 依赖。')
    }

    return remoteControlAgentStatus.value === 'ready'
  } catch (error) {
    remoteControlAgentStatus.value = 'offline'

    if (!quiet && !hasShownRemoteAgentHint) {
      hasShownRemoteAgentHint = true
      pushSystemMessage('共享方本机未启动远控执行端，真实远控暂不可用。请在共享方机器执行 `npm run remote-agent`。')
    }

    return false
  }
}

function getSharedScreenCaptureMeta() {
  const videoTrack = sharedOutgoingStream.value?.getVideoTracks?.()[0]
  const settings = videoTrack?.getSettings?.() || {}
  return {
    displaySurface: settings.displaySurface || '',
    width: Number(settings.width || 0),
    height: Number(settings.height || 0),
    screenWidth: Number(window.screen?.width || 0),
    screenHeight: Number(window.screen?.height || 0),
    pixelRatio: Number(window.devicePixelRatio || 1)
  }
}

async function applySenderVideoQualityProfile(sender, profile = getMeshVideoQualityProfile()) {
  if (!sender?.track || sender.track.kind !== 'video' || typeof sender.getParameters !== 'function' || typeof sender.setParameters !== 'function') {
    return
  }

  try {
    const params = sender.getParameters() || {}
    const encodings = Array.isArray(params.encodings) && params.encodings.length ? params.encodings : [{}]
    params.encodings = encodings.map((encoding, index) => {
      if (index > 0) {
        return encoding
      }

      return {
        ...encoding,
        maxBitrate: profile.maxBitrate,
        maxFramerate: profile.frameRate
      }
    })

    await sender.setParameters(params)
  } catch (error) {
    console.error('应用视频发送质量配置失败:', error)
  }
}

async function applyScreenShareTrackConstraints(track, profile = getMeshVideoQualityProfile()) {
  if (!track?.applyConstraints) {
    return
  }

  try {
    await track.applyConstraints({
      width: { max: profile.width },
      height: { max: profile.height },
      frameRate: { max: profile.frameRate }
    })
  } catch (error) {
    console.error('调整屏幕共享采集质量失败:', error)
  }
}

function applyLocalStreamQualityProfile() {
  const profile = getMeshVideoQualityProfile()
  Object.values(localTrackSenders).forEach((senders) => {
    applySenderVideoQualityProfile(senders?.video, profile)
  })
}

function applySharedStreamQualityProfile() {
  const share = activeShare.value
  if (!share || !isStreamShare(share) || share.ownerId !== selfId.value) {
    return
  }

  const profile = getMeshVideoQualityProfile()
  if (share.kind === 'screen') {
    const track = sharedOutgoingStream.value?.getVideoTracks?.()[0]
    applyScreenShareTrackConstraints(track, profile)
  }

  Object.values(sharedTrackSenders).forEach((senders) => {
    applySenderVideoQualityProfile(senders?.video, profile)
  })
}

function refreshOutgoingMediaQuality() {
  applyLocalStreamQualityProfile()
  applySharedStreamQualityProfile()
}

async function forwardRemoteControlCommandToAgent(command, senderName = '') {
  const capture = getSharedScreenCaptureMeta()

  if (capture.displaySurface && capture.displaySurface !== 'monitor') {
    if (!hasShownRemoteAgentHint) {
      hasShownRemoteAgentHint = true
      pushSystemMessage('当前只支持“共享整个屏幕”时的真实远控。请重新选择整屏共享。')
    }
    return
  }

  const ready = await checkRemoteControlAgent({ quiet: true })
  if (!ready) {
    if (!hasShownRemoteAgentHint) {
      hasShownRemoteAgentHint = true
      pushSystemMessage('已收到远控指令，但共享方本机未启动远控执行端。请执行 `npm run remote-agent`。')
    }
    return
  }

  try {
    const response = await fetch(`${REMOTE_CONTROL_AGENT_URL}/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        senderName,
        command,
        capture
      })
    })

    const payload = await response.json().catch(() => ({}))
    if (!response.ok || payload.ok === false) {
      throw new Error(payload.message || `execute-${response.status}`)
    }
  } catch (error) {
    console.error('转发远控命令到本地执行端失败:', error)
    if (!hasShownRemoteAgentHint) {
      hasShownRemoteAgentHint = true
      pushSystemMessage('远控执行端调用失败，请检查本地 agent 是否启动，以及系统是否已授予辅助功能权限。')
    }
  }
}

function revokeObjectUrl(url) {
  if (typeof url === 'string' && url.startsWith('blob:')) {
    URL.revokeObjectURL(url)
  }
}

function setActiveSharePointer(pointer) {
  if (activeShare.value) {
    activeShare.value.pointer = pointer
  }
}

function captureSharedVideoState() {
  const video = sharedVideoRef.value
  if (!video) {
    return {
      currentTime: 0,
      shouldResume: false
    }
  }

  return {
    currentTime: Number.isFinite(video.currentTime) ? video.currentTime : 0,
    shouldResume: !video.paused && !video.ended
  }
}

function syncSharedVideoElementSource() {
  const video = sharedVideoRef.value
  if (!video) {
    return
  }

  if (!activeShare.value || !isVideoLikeShare(activeShare.value)) {
    if (video.srcObject) {
      video.srcObject = null
    }
    return
  }

  if (activeShare.value.kind === 'screen') {
    video.removeAttribute('src')
    const nextStream = activeShare.value.ownerId === selfId.value
      ? sharedOutgoingStream.value
      : sharedIncomingStream.value

    if (video.srcObject !== nextStream) {
      video.srcObject = nextStream || null
      if (nextStream) {
        video.play().catch((error) => {
          console.error('挂载屏幕共享流后自动播放失败:', error)
        })
      }
    }
    return
  }

  if (isStreamShare() && activeShare.value.ownerId !== selfId.value) {
    video.removeAttribute('src')
    if (video.srcObject !== sharedIncomingStream.value) {
      video.srcObject = sharedIncomingStream.value || null
      if (sharedIncomingStream.value) {
        video.play().catch((error) => {
          console.error('挂载实时视频流后自动播放失败:', error)
        })
      }
    }
    return
  }

  if (video.srcObject) {
    video.srcObject = null
  }
}

function resetSharedVideoTransport() {
  livekitPublisherSession.disconnect().catch(() => {})
  livekitSubscriberSession.disconnect().catch(() => {})

  Object.keys(sharedTrackSenders).forEach((peerId) => {
    const senders = Object.values(sharedTrackSenders[peerId] || {})
    senders.forEach((sender) => {
      sender?.replaceTrack(null).catch((error) => {
        console.error('清空共享视频轨道失败:', error)
      })
    })
  })

  if (sharedOutgoingStream.value) {
    sharedOutgoingStream.value.getTracks().forEach((track) => track.stop())
    sharedOutgoingStream.value = null
  }

  sharedIncomingStream.value = null
  syncSharedVideoUiFromState(null)
  restartSharedVideoUiTicker()
  restartIncomingStreamHealthMonitor()
}

function updateActiveShare(patch) {
  const previous = activeShare.value
  const nextShare = {
    ...(previous || {}),
    ...patch,
    url: patch.url !== undefined ? patch.url : previous?.url || '',
    progress: patch.progress !== undefined ? patch.progress : previous?.progress || 0,
    isReceiving: patch.isReceiving !== undefined ? patch.isReceiving : previous?.isReceiving || false,
    zoomed: patch.zoomed !== undefined ? patch.zoomed : previous?.zoomed || false,
    deliveryMode: patch.deliveryMode !== undefined ? patch.deliveryMode : previous?.deliveryMode || 'file',
    streamId: patch.streamId !== undefined ? patch.streamId : previous?.streamId || null,
    sync: patch.sync !== undefined ? patch.sync : previous?.sync || null,
    pointer: patch.pointer !== undefined ? patch.pointer : previous?.pointer || null,
    controllerId: patch.controllerId !== undefined
      ? patch.controllerId
      : patch.sync?.controllerId || previous?.controllerId || null
  }

  if (previous?.url && previous.url !== nextShare.url) {
    revokeObjectUrl(previous.url)
  }

  activeShare.value = nextShare
  if (nextShare.kind === 'video') {
    syncSharedVideoUiFromState(nextShare.sync)
  } else {
    syncSharedVideoUiFromState(null)
  }
  if (nextShare.kind === 'webpage') {
    syncActiveWebpageLoadedState(nextShare)
  } else {
    webpageLoaded.value = false
  }
  restartSharedVideoUiTicker()
  restartIncomingStreamHealthMonitor()
}

function updateParticipants(nextParticipants = []) {
  participants.value = [...nextParticipants].sort((left, right) => {
    if (left.isAdmin && !right.isAdmin) return -1
    if (!left.isAdmin && right.isAdmin) return 1
    if (left.isController && !right.isController) return -1
    if (!left.isController && right.isController) return 1
    return left.name.localeCompare(right.name, 'zh-Hans-CN')
  })
}

function clearIncomingTransfers(keepMediaId = null) {
  Object.keys(incomingTransfers).forEach((key) => {
    if (!keepMediaId || !key.endsWith(`:${keepMediaId}`)) {
      const transfer = incomingTransfers[key]
      if (transfer?.previewUrl) {
        revokeObjectUrl(transfer.previewUrl)
      }
      delete incomingTransfers[key]
    }
  })
}

function clearActiveShare() {
  cancelSharedVideoPlayRequest()
  hasShownSharedVideoAutoplayHint = false
  resetSharedVideoTransport()
  clearRemoteCommandOverlay()

  if (activeShare.value?.url) {
    revokeObjectUrl(activeShare.value.url)
  }

  activeShare.value = null
  currentSharedFile.value = null
  pendingStreamShareFile.value = null
  lastVideoHeartbeatAt.value = 0
  sharedVideoMuted.value = true
  sharedVideoHasLocalMuteOverride.value = false
  sharedVideoLocalPaused.value = false
  sharedVideoUi.muted = true
  webpageLoaded.value = false
  Object.keys(webpageIframeLoadState).forEach((key) => {
    delete webpageIframeLoadState[key]
  })
  clearIncomingTransfers()

  Object.keys(outboundDeliveries).forEach((key) => {
    delete outboundDeliveries[key]
  })
}

function openIncomingShare(media) {
  if (!media) {
    return
  }

  clearIncomingTransfers(media.id)

  updateActiveShare({
    id: media.id,
    kind: media.kind,
    fileName: media.fileName,
    fileType: media.fileType,
    fileSize: media.fileSize,
    ownerId: media.ownerId,
    ownerName: media.ownerName,
    url: media.url || '',
    webpageReloadToken: Number(media.reloadToken || 0) || undefined,
    webpageHistory: media.webpageHistory || undefined,
    webpageActiveIndex: Number(media.webpageActiveIndex || 0),
    zoomed: Boolean(media.zoomed),
    deliveryMode: media.deliveryMode || 'file',
    streamId: media.streamId || null,
    pointer: media.pointer || null,
    sync: media.sync || (media.kind === 'video'
      ? {
          action: 'ready',
          playing: false,
          currentTime: 0,
          duration: Number(media.duration || 0),
          muted: true,
          updatedAt: Date.now(),
          controllerId: media.ownerId
        }
      : null),
    isReceiving: media.ownerId !== selfId.value && !activeShare.value?.url,
    progress: media.ownerId === selfId.value ? 100 : activeShare.value?.progress || 0
  })

  if (media.ownerId !== selfId.value) {
    currentSharedFile.value = null
    if (isStreamShare(media)) {
      tryBindSharedIncomingStream(media.ownerId)
    }
  }

  if (media.kind === 'video') {
    sharedVideoMuted.value = Boolean(media.sync?.muted ?? true)
    sharedVideoUi.muted = sharedVideoMuted.value
  }
}

function requestShareSync(mediaId) {
  if (!socket.value?.connected || !activeShare.value || activeShare.value.ownerId === selfId.value) {
    return
  }

  socket.value.emit('request-share-sync', {
    roomId: roomId.value,
    mediaId
  })
}

function bindRemoteVideo(peerId, element) {
  if (!element) {
    delete remoteVideoElements[peerId]
    return
  }

  remoteVideoElements[peerId] = element
  syncRemoteVideo(peerId)
}

function syncRemoteVideo(peerId) {
  const element = remoteVideoElements[peerId]
  const stream = remoteStreams[peerId]
  if (!element) {
    return
  }

  if (element.srcObject !== stream) {
    element.srcObject = stream || null
  }

  element.muted = !isSpeakerOn.value
  element.volume = isSpeakerOn.value ? 1 : 0
}

function hasLiveVideoTrack(stream) {
  return Boolean(stream?.getVideoTracks().some((track) => track.readyState === 'live'))
}

function isLiveStreamCandidate(stream) {
  return Boolean(stream?.getTracks?.().some((track) => track.readyState === 'live'))
}

function rememberPeerStream(peerId, stream) {
  if (!stream?.id) {
    return
  }
  if (!peerStreamCatalog[peerId]) {
    peerStreamCatalog[peerId] = {}
  }
  peerStreamCatalog[peerId][stream.id] = stream
}

function getPeerStreams(peerId) {
  return Object.values(peerStreamCatalog[peerId] || {})
}

function prunePeerStreams(peerId) {
  const catalog = peerStreamCatalog[peerId]
  if (!catalog) {
    return []
  }

  Object.entries(catalog).forEach(([streamId, stream]) => {
    if (!isLiveStreamCandidate(stream)) {
      delete catalog[streamId]
    }
  })

  const streams = Object.values(catalog)
  if (!streams.length) {
    delete peerStreamCatalog[peerId]
  }

  return streams
}

function pickPrimaryPeerStream(peerId) {
  const streams = prunePeerStreams(peerId)
  if (!streams.length) {
    return null
  }

  if (
    isVideoLikeShare(activeShare.value)
    && activeShare.value.ownerId === peerId
    && isStreamShare(activeShare.value)
  ) {
    return streams.find((stream) => (
      stream.id !== (sharedIncomingStream.value?.id || activeShare.value.streamId)
      && isLiveStreamCandidate(stream)
    )) || null
  }

  return streams.find((stream) => isLiveStreamCandidate(stream)) || streams[0]
}

function tryBindSharedIncomingStream(peerId) {
  if (
    !activeShare.value
    || !isVideoLikeShare(activeShare.value)
    || !isStreamShare(activeShare.value)
    || activeShare.value.ownerId !== peerId
    || activeShare.value.ownerId === selfId.value
  ) {
    return false
  }

  const streams = prunePeerStreams(peerId)
  if (!streams.length) {
    return false
  }

  let candidate = null

  if (activeShare.value.streamId) {
    candidate = streams.find((stream) => stream.id === activeShare.value.streamId) || null
  }

  if (!candidate) {
    candidate = streams.find((stream) => stream !== remoteStreams[peerId] && isLiveStreamCandidate(stream)) || null
  }

  if (!candidate) {
    candidate = streams.find((stream) => isLiveStreamCandidate(stream)) || null
  }

  if (!candidate) {
    candidate = streams.find((stream) => stream !== remoteStreams[peerId]) || streams[0]
  }

  if (!candidate) {
    return false
  }

  sharedIncomingStream.value = candidate
  updateActiveShare({
    isReceiving: false,
    progress: 100
  })
  nextTick(() => {
    syncSharedVideoElementSource()
    markIncomingStreamHealthy()
  })
  return true
}

function refreshPeerDisplayStream(peerId) {
  const nextStream = pickPrimaryPeerStream(peerId)
  if (nextStream) {
    remoteStreams[peerId] = nextStream
  } else {
    delete remoteStreams[peerId]
  }
  syncRemoteVideo(peerId)
}

function syncLocalVideo() {
  if (localVideoRef.value) {
    localVideoRef.value.srcObject = localMediaStream.value || null
  }
}

function syncRemoteAudioPlayback() {
  Object.keys(remoteVideoElements).forEach((peerId) => {
    syncRemoteVideo(peerId)
  })
}

function updateLocalMediaFlags() {
  isAudioOn.value = Boolean(localMediaStream.value?.getAudioTracks().some((track) => track.readyState === 'live'))
  isVideoOn.value = Boolean(localMediaStream.value?.getVideoTracks().some((track) => track.readyState === 'live'))
}

function ensureLocalMediaStream() {
  if (!localMediaStream.value) {
    localMediaStream.value = new MediaStream()
  }
  return localMediaStream.value
}

function refreshLocalTracksForPeers() {
  Object.keys(peerConnections).forEach((peerId) => {
    detachLocalTracksFromPeer(peerId)
    syncLocalTracksToPeer(peerId)
    queueSharedNegotiation(peerId)
  })
}

function attachLocalTrack(track) {
  if (!track) {
    return
  }

  const stream = ensureLocalMediaStream()
  const previousTrack = stream.getTracks().find((item) => item.kind === track.kind)

  if (previousTrack) {
    stream.removeTrack(previousTrack)
    previousTrack.stop()
  }

  stream.addTrack(track)
  updateLocalMediaFlags()
}

function removeLocalTrack(kind) {
  const stream = localMediaStream.value
  if (!stream) {
    updateLocalMediaFlags()
    return
  }

  stream.getTracks()
    .filter((track) => track.kind === kind)
    .forEach((track) => {
      stream.removeTrack(track)
      track.stop()
    })

  if (!stream.getTracks().length) {
    localMediaStream.value = null
  }

  updateLocalMediaFlags()
}

function ensurePeerSenderCache(store, peerId) {
  if (!store[peerId]) {
    store[peerId] = {
      audio: null,
      video: null
    }
  }

  return store[peerId]
}

async function enableLocalTrack(kind) {
  const constraintKey = kind === 'audio' ? 'audio' : 'video'

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: constraintKey === 'audio',
      video: constraintKey === 'video'
    })
    const [track] = kind === 'audio' ? stream.getAudioTracks() : stream.getVideoTracks()
    if (!track) {
      throw new Error(`未获取到${kind === 'audio' ? '音频' : '视频'}轨道`)
    }

    stream.getTracks().forEach((item) => {
      if (item !== track) {
        item.stop()
      }
    })

    attachLocalTrack(track)
    await nextTick()
    syncLocalVideo()
    refreshLocalTracksForPeers()
  } catch (error) {
    console.error(`开启${kind === 'audio' ? '麦克风' : '摄像头'}失败:`, error)
    alert(kind === 'audio' ? '无法访问麦克风' : '无法访问摄像头')
  }
}

async function waitForDataChannelDrain(channel) {
  while (channel.readyState === 'open' && channel.bufferedAmount > DATA_CHANNEL_BUFFER_LIMIT) {
    await new Promise((resolve) => setTimeout(resolve, 30))
  }
}

function markShareDeliveryPending(peerId, mediaId) {
  outboundDeliveries[deliveryKey(peerId, mediaId)] = 'pending'
}

function queueSharedNegotiation(peerId) {
  const pc = peerConnections[peerId]
  if (!pc || pc.signalingState === 'closed') {
    return
  }

  pendingSharedNegotiations[peerId] = true

  if (makingOffer[peerId] || pc.signalingState !== 'stable') {
    return
  }

  pendingSharedNegotiations[peerId] = false
  negotiatePeer(peerId)
}

function attachSharedStreamToPeer(peerId, options = {}) {
  const { forceNegotiation = false } = options
  const share = activeShare.value
  const pc = peerConnections[peerId]
  const stream = sharedOutgoingStream.value

  if (!share || !pc || !stream || !isStreamShare(share) || share.ownerId !== selfId.value || peerId === selfId.value) {
    return
  }

  const senderCache = sharedTrackSenders[peerId] || ensurePeerSenderCache(sharedTrackSenders, peerId)
  const tracksByKind = stream.getTracks().reduce((result, track) => {
    result[track.kind] = track
    return result
  }, {})

  ;['audio', 'video'].forEach((kind) => {
    const nextTrack = tracksByKind[kind] || null
    const sender = senderCache[kind]

    if (sender) {
      if (sender.track !== nextTrack) {
        sender.replaceTrack(nextTrack).catch((error) => {
          console.error('替换共享流轨道失败:', error)
        })
      }
      applySenderVideoQualityProfile(sender, getMeshVideoQualityProfile())
      return
    }

    if (nextTrack) {
      senderCache[kind] = pc.addTrack(nextTrack, stream)
      applySenderVideoQualityProfile(senderCache[kind], getMeshVideoQualityProfile())
    }
  })

  if (forceNegotiation || sharedTrackSenders[peerId]?.audio || sharedTrackSenders[peerId]?.video) {
    queueSharedNegotiation(peerId)
  }
}

function startFileShare(file, kind) {
  const shareId = createId('share_')
  const url = URL.createObjectURL(file)

  clearActiveShare()

  currentSharedFile.value = file
  updateActiveShare({
    id: shareId,
    kind,
    fileName: file.name,
    fileType: file.type,
    fileSize: file.size,
    ownerId: selfId.value,
    ownerName: displayName.value,
    url,
    isReceiving: false,
    progress: 100,
    zoomed: false,
    deliveryMode: 'file',
    streamId: null,
    controllerId: selfId.value,
    sync: kind === 'video'
      ? {
          action: 'ready',
          playing: false,
          currentTime: 0,
          duration: 0,
          updatedAt: Date.now(),
          controllerId: selfId.value
        }
      : null
  })

  pushSystemMessage(`你共享了${kind === 'image' ? '图片' : '视频'} ${file.name}`)

  socket.value?.emit('share-start', {
    roomId: roomId.value,
    media: {
      id: shareId,
      kind,
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
      deliveryMode: 'file'
    }
  })

  otherParticipants.value.forEach((peer) => {
    markShareDeliveryPending(peer.id, shareId)
    ensureShareDelivery(peer.id, true)
  })
}


async function fetchRealtimeShareConfig() {
  if (realtimeShareConfig.loaded) {
    return realtimeShareConfig
  }

  try {
    const response = await fetch('/api/realtime-share/config')
    const payload = await response.json()
    realtimeShareConfig.loaded = true
    realtimeShareConfig.enabled = Boolean(payload.enabled)
    realtimeShareConfig.url = payload.url || ''
    realtimeShareConfig.message = payload.message || ''
  } catch (error) {
    realtimeShareConfig.loaded = true
    realtimeShareConfig.enabled = false
    realtimeShareConfig.url = ''
    realtimeShareConfig.message = error?.message || 'LiveKit 配置读取失败'
  }

  return realtimeShareConfig
}

async function requestRealtimeShareToken({ canPublish = false, canSubscribe = true } = {}) {
  const response = await fetch('/api/realtime-share/token', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      roomId: roomId.value,
      participantId: selfId.value || clientId,
      participantName: displayName.value,
      canPublish,
      canSubscribe
    })
  })

  const payload = await response.json()
  if (!response.ok) {
    throw new Error(payload?.message || 'LiveKit token 获取失败')
  }

  return payload
}

async function connectIncomingLivekitShare(media) {
  const livekitRoomName = media?.livekitRoomName || roomId.value
  if (!livekitRoomName) {
    return
  }

  try {
    await livekitSubscriberSession.disconnect()
    const tokenPayload = await requestRealtimeShareToken({ canPublish: false, canSubscribe: true })
    await livekitSubscriberSession.connectSubscriber({
      url: tokenPayload.url,
      token: tokenPayload.token,
      onTrack: (track) => {
        const mediaTrack = track?.mediaStreamTrack || track
        if (!mediaTrack || mediaTrack.kind !== 'video') {
          return
        }
        sharedIncomingStream.value = new MediaStream([mediaTrack])
        nextTick(() => {
          syncSharedVideoElementSource()
        })
      }
    })
  } catch (error) {
    console.error('接入 LiveKit 共享失败:', error)
  }
}

function startRealtimeVideoShare(file) {
  const shareId = createId('share_')
  const url = URL.createObjectURL(file)

  clearActiveShare()

  currentSharedFile.value = null
  pendingStreamShareFile.value = file
  updateActiveShare({
    id: shareId,
    kind: 'video',
    fileName: file.name,
    fileType: file.type,
    fileSize: file.size,
    ownerId: selfId.value,
    ownerName: displayName.value,
    url,
    isReceiving: false,
    progress: 100,
    zoomed: false,
    deliveryMode: 'stream',
    streamId: null,
    controllerId: selfId.value,
    sync: {
      action: 'ready',
      playing: false,
      currentTime: 0,
      duration: 0,
      updatedAt: Date.now(),
      controllerId: selfId.value
    }
  })

  pushSystemMessage(`你开始实时共享视频 ${file.name}`)
}

async function startBrowserTabShare() {
  return startScreenShare('browser')
}

async function startScreenShare(sourceType = 'screen') {
  if (!window.isSecureContext) {
    alert('当前页面不是安全上下文，请通过 https:// 域名访问后再使用屏幕共享')
    return
  }

  if (!navigator.mediaDevices?.getDisplayMedia) {
    alert('当前浏览器或运行环境不支持网页屏幕共享，请使用最新版桌面 Chrome、Edge 或 Safari，并通过 HTTPS 访问')
    return
  }

  if (!canShare.value) {
    alert('仅房主可以发起屏幕共享')
    return
  }

  try {
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: sourceType !== 'browser'
    })
    const shareId = createId('share_')
    const shareLabel = sourceType === 'browser' ? '网页画面共享' : '屏幕共享'
    const realtimeConfig = await fetchRealtimeShareConfig()

    clearActiveShare()

    sharedOutgoingStream.value = stream
    currentSharedFile.value = null
    pendingStreamShareFile.value = null

    const displayTrack = stream.getVideoTracks()[0]
    if (displayTrack) {
      displayTrack.onended = () => {
        if (activeShare.value?.id === shareId && activeShare.value.kind === 'screen') {
          closeSharedMedia(true)
        }
      }
    }

    hasShownRemoteAgentHint = false
    remoteControlAgentStatus.value = 'unknown'

    let deliveryMode = 'stream'
    let livekitRoomName = ''
    let livekitTrackSid = ''

    if (realtimeConfig.enabled) {
      const tokenPayload = await requestRealtimeShareToken({ canPublish: true, canSubscribe: true })
      const publishResult = await livekitPublisherSession.connectPublisher({
        url: tokenPayload.url,
        token: tokenPayload.token,
        stream
      })
      deliveryMode = 'livekit'
      livekitRoomName = roomId.value
      livekitTrackSid = publishResult.trackSid || ''
    }

    updateActiveShare({
      id: shareId,
      kind: 'screen',
      fileName: shareLabel,
      fileType: 'screen/stream',
      fileSize: 0,
      ownerId: selfId.value,
      ownerName: displayName.value,
      url: '',
      isReceiving: false,
      progress: 100,
      zoomed: false,
      deliveryMode,
      streamId: stream.id,
      sourceType,
      livekitRoomName,
      livekitTrackSid,
      shareLabel,
      pointer: null,
      controllerId: selfId.value,
      sync: null
    })

    socket.value?.emit('share-start', {
      roomId: roomId.value,
      media: {
        id: shareId,
        kind: 'screen',
        fileName: shareLabel,
        fileType: 'screen/stream',
        fileSize: 0,
        deliveryMode,
        streamId: stream.id,
        sourceType,
        livekitRoomName: roomId.value,
        livekitTrackSid,
        shareLabel
      }
    })

    await nextTick()
    syncSharedVideoElementSource()

    if (deliveryMode === 'stream') {
      Object.keys(peerConnections).forEach((peerId) => {
        attachSharedStreamToPeer(peerId)
      })
    }

    pushSystemMessage(`你开始了${shareLabel}`)
  } catch (error) {
    if (error?.name === 'NotAllowedError') {
      alert('你已取消屏幕共享授权')
      return
    }

    console.error('屏幕共享启动失败:', error)
  }
}

function initializeOwnedSharedVideoStream() {
  const share = activeShare.value
  const video = sharedVideoRef.value

  if (!share || !video || share.ownerId !== selfId.value || !isStreamShare(share) || share.streamId) {
    return
  }

  const stream = typeof video.captureStream === 'function'
    ? video.captureStream()
    : typeof video.mozCaptureStream === 'function'
      ? video.mozCaptureStream()
      : null

  if (!stream) {
    const fallbackFile = pendingStreamShareFile.value
    if (fallbackFile) {
      alert('当前浏览器不支持实时视频流共享，已回退为文件共享模式')
      startFileShare(fallbackFile, 'video')
    }
    return
  }

  sharedOutgoingStream.value = stream
  pendingStreamShareFile.value = null

  const sync = {
    action: 'ready',
    playing: !video.paused && !video.ended,
    currentTime: video.currentTime || 0,
    duration: Number(video.duration || 0),
    updatedAt: Date.now(),
    controllerId: selfId.value
  }

  updateActiveShare({
    streamId: stream.id,
    sync
  })

  socket.value?.emit('share-start', {
    roomId: roomId.value,
    media: {
      id: share.id,
      kind: 'video',
      fileName: share.fileName,
      fileType: share.fileType,
      fileSize: share.fileSize,
      deliveryMode: 'stream',
      streamId: stream.id,
      duration: sync.duration
    }
  })

  Object.keys(peerConnections).forEach((peerId) => {
    attachSharedStreamToPeer(peerId)
  })

  emitShareControl('ready', {
    currentTime: sync.currentTime,
    playing: sync.playing,
    duration: sync.duration
  })
}

async function ensureShareDelivery(peerId, force = false) {
  const share = activeShare.value
  const file = currentSharedFile.value
  if (!share || share.ownerId !== selfId.value || peerId === selfId.value) {
    return
  }

  if (isStreamShare(share)) {
    attachSharedStreamToPeer(peerId, { forceNegotiation: force })
    outboundDeliveries[deliveryKey(peerId, share.id)] = 'done'
    return
  }

  if (!file) {
    return
  }

  const channel = dataChannels[peerId]
  const key = deliveryKey(peerId, share.id)
  if (!channel || channel.readyState !== 'open') {
    outboundDeliveries[key] = 'pending'
    return
  }

  if (!force && (outboundDeliveries[key] === 'sending' || outboundDeliveries[key] === 'done')) {
    return
  }

  const totalChunks = Math.ceil(file.size / SHARE_CHUNK_SIZE)
  outboundDeliveries[key] = 'sending'

  try {
    channel.send(JSON.stringify({
      kind: 'share-init',
      mediaId: share.id,
      mediaKind: share.kind,
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
      totalChunks,
      ownerId: share.ownerId,
      ownerName: share.ownerName,
      zoomed: share.zoomed,
      sync: share.sync
    }))

    let index = 0
    for (let offset = 0; offset < file.size; offset += SHARE_CHUNK_SIZE) {
      const buffer = await file.slice(offset, offset + SHARE_CHUNK_SIZE).arrayBuffer()
      await waitForDataChannelDrain(channel)
      channel.send(JSON.stringify({
        kind: 'share-chunk-header',
        mediaId: share.id,
        index
      }))
      channel.send(buffer)
      index += 1
    }

    channel.send(JSON.stringify({
      kind: 'share-complete',
      mediaId: share.id
    }))

    outboundDeliveries[key] = 'done'
  } catch (error) {
    console.error('共享文件发送失败:', error)
    outboundDeliveries[key] = 'pending'
  }
}

function handleShareInit(peerId, payload) {
  if (activeShare.value?.id && activeShare.value.id !== payload.mediaId) {
    return
  }

  incomingTransfers[transferKey(peerId, payload.mediaId)] = {
    mediaId: payload.mediaId,
    mediaKind: payload.mediaKind,
    fileName: payload.fileName,
    fileType: payload.fileType,
    fileSize: payload.fileSize,
    totalChunks: payload.totalChunks,
    chunks: new Array(payload.totalChunks),
    receivedChunks: 0,
    receivedBytes: 0,
    previewUrl: '',
    previewBytes: 0,
    lastPreviewAt: 0
  }

  openIncomingShare({
    id: payload.mediaId,
    kind: payload.mediaKind,
    fileName: payload.fileName,
    fileType: payload.fileType,
    fileSize: payload.fileSize,
    ownerId: payload.ownerId || peerId,
    ownerName: payload.ownerName || getParticipantName(peerId),
    zoomed: payload.zoomed,
    deliveryMode: 'file',
    sync: payload.sync || null
  })

  updateActiveShare({
    isReceiving: true,
    progress: 0
  })
}

function getContiguousTransferStats(transfer) {
  const contiguousChunks = []
  let contiguousBytes = 0

  for (let index = 0; index < transfer.totalChunks; index += 1) {
    const chunk = transfer.chunks[index]
    if (!chunk) {
      break
    }
    contiguousChunks.push(chunk)
    contiguousBytes += chunk.byteLength
  }

  return {
    contiguousChunks,
    contiguousBytes,
    contiguousCount: contiguousChunks.length
  }
}

async function updateIncomingVideoPreview(peerId, mediaId, force = false) {
  const key = transferKey(peerId, mediaId)
  const transfer = incomingTransfers[key]

  if (!transfer || transfer.mediaKind !== 'video') {
    return
  }

  const { contiguousChunks, contiguousBytes, contiguousCount } = getContiguousTransferStats(transfer)
  const minPreviewBytes = Math.min(
    transfer.fileSize || VIDEO_PREVIEW_MIN_BYTES,
    VIDEO_PREVIEW_MIN_BYTES
  )

  if (!force) {
    if (contiguousCount < 2 || contiguousBytes < minPreviewBytes) {
      return
    }

    const bytesGrownEnough = contiguousBytes - (transfer.previewBytes || 0) >= VIDEO_PREVIEW_UPDATE_BYTES
    const waitedEnough = Date.now() - (transfer.lastPreviewAt || 0) >= VIDEO_PREVIEW_UPDATE_INTERVAL
    if (transfer.previewUrl && (!bytesGrownEnough || !waitedEnough)) {
      return
    }
  }

  if (!contiguousChunks.length) {
    return
  }

  const previousState = captureSharedVideoState()
  const blob = new Blob(contiguousChunks, {
    type: transfer.fileType || 'video/mp4'
  })
  const previewUrl = URL.createObjectURL(blob)

  if (transfer.previewUrl && transfer.previewUrl !== activeShare.value?.url) {
    revokeObjectUrl(transfer.previewUrl)
  }

  transfer.previewUrl = previewUrl
  transfer.previewBytes = contiguousBytes
  transfer.lastPreviewAt = Date.now()

  updateActiveShare({
    id: mediaId,
    kind: 'video',
    fileName: transfer.fileName,
    fileType: transfer.fileType,
    fileSize: transfer.fileSize,
    ownerId: activeShare.value?.ownerId || peerId,
    ownerName: activeShare.value?.ownerName || getParticipantName(peerId),
    url: previewUrl,
    isReceiving: true,
    progress: transfer.fileSize
      ? Math.min(99, (transfer.receivedBytes / transfer.fileSize) * 100)
      : activeShare.value?.progress || 0
  })

  await nextTick()

  const video = sharedVideoRef.value
  if (!video) {
    return
  }

  if (previousState.currentTime > 0) {
    const safeTargetTime = Math.min(previousState.currentTime, video.duration || previousState.currentTime)
    try {
      video.currentTime = safeTargetTime
    } catch (error) {
      console.error('恢复预缓存播放位置失败:', error)
    }
  }

  if (activeShare.value?.sync) {
    applyVideoSync(activeShare.value.sync, true)
    return
  }

  if (previousState.shouldResume) {
    playSharedVideoSafely({ source: '预缓存播放' })
  }
}

async function handleIncomingShareChunk(peerId, mediaId, index, buffer) {
  const key = transferKey(peerId, mediaId)
  const transfer = incomingTransfers[key]

  if (!transfer || transfer.chunks[index]) {
    return
  }

  transfer.chunks[index] = buffer
  transfer.receivedChunks += 1
  transfer.receivedBytes += buffer.byteLength

  if (activeShare.value?.id === mediaId) {
    const progress = transfer.fileSize
      ? Math.min(100, (transfer.receivedBytes / transfer.fileSize) * 100)
      : Math.min(100, (transfer.receivedChunks / Math.max(transfer.totalChunks, 1)) * 100)

    updateActiveShare({
      isReceiving: true,
      progress
    })
  }

  if (transfer.mediaKind === 'video') {
    await updateIncomingVideoPreview(peerId, mediaId)
  }
}

async function finalizeIncomingShare(peerId, mediaId) {
  const key = transferKey(peerId, mediaId)
  const transfer = incomingTransfers[key]
  if (!transfer) {
    return
  }

  if (transfer.chunks.some((chunk) => !chunk)) {
    requestShareSync(mediaId)
    return
  }

  const previousState = captureSharedVideoState()
  const blob = new Blob(transfer.chunks, {
    type: transfer.fileType || (transfer.mediaKind === 'image' ? 'image/*' : 'video/mp4')
  })
  const url = URL.createObjectURL(blob)

  if (transfer.previewUrl && transfer.previewUrl !== url) {
    revokeObjectUrl(transfer.previewUrl)
  }

  updateActiveShare({
    id: mediaId,
    kind: transfer.mediaKind,
    fileName: transfer.fileName,
    fileType: transfer.fileType,
    fileSize: transfer.fileSize,
    ownerId: activeShare.value?.ownerId || peerId,
    ownerName: activeShare.value?.ownerName || getParticipantName(peerId),
    url,
    isReceiving: false,
    progress: 100
  })

  delete incomingTransfers[key]

  if (activeShare.value?.kind === 'video') {
    await nextTick()
    if (!activeShare.value.sync && previousState.currentTime > 0 && sharedVideoRef.value) {
      try {
        sharedVideoRef.value.currentTime = Math.min(previousState.currentTime, sharedVideoRef.value.duration || previousState.currentTime)
      } catch (error) {
        console.error('恢复完整视频位置失败:', error)
      }
    }
    applyVideoSync(activeShare.value.sync, true)
  }
}

async function handleDataChannelMessage(peerId, rawData) {
  if (typeof rawData === 'string') {
    let payload

    try {
      payload = JSON.parse(rawData)
    } catch (error) {
      console.error('数据通道消息解析失败:', error)
      return
    }

    if (payload.kind === 'share-init') {
      handleShareInit(peerId, payload)
      return
    }

    if (payload.kind === 'share-chunk-header') {
      pendingBinaryHeaders[peerId] = payload
      return
    }

    if (payload.kind === 'share-complete') {
      await finalizeIncomingShare(peerId, payload.mediaId)
    }

    return
  }

  const header = pendingBinaryHeaders[peerId]
  if (!header) {
    return
  }

  delete pendingBinaryHeaders[peerId]

  const buffer = rawData instanceof ArrayBuffer ? rawData : await rawData.arrayBuffer()
  await handleIncomingShareChunk(peerId, header.mediaId, header.index, buffer)
}

function isExpectedDataChannelAbortError(error, channel) {
  if (channel?.__expectedClose) {
    return true
  }

  const detail = [
    error?.error?.message,
    error?.error?.reason,
    error?.message,
    error?.reason
  ].filter(Boolean).join(' ')

  return /User-Initiated Abort|Close called/i.test(detail)
}

function registerDataChannel(peerId, channel) {
  channel.binaryType = 'arraybuffer'
  channel.__expectedClose = false
  dataChannels[peerId] = channel

  channel.onopen = () => {
    dataChannels[peerId] = channel
    if (activeShare.value?.ownerId === selfId.value) {
      ensureShareDelivery(peerId)
    } else if (activeShare.value?.ownerId === peerId && (!activeShare.value.url || hasIncompleteIncomingTransfer(peerId, activeShare.value.id))) {
      requestShareSync(activeShare.value.id)
    }
  }

  channel.onmessage = async (event) => {
    await handleDataChannelMessage(peerId, event.data)
  }

  channel.onclose = () => {
    const expectedClose = Boolean(channel.__expectedClose)
    if (dataChannels[peerId] === channel) {
      delete dataChannels[peerId]
    }

    if (!expectedClose && activeShare.value?.ownerId === peerId && hasIncompleteIncomingTransfer(peerId, activeShare.value.id)) {
      requestShareSync(activeShare.value.id)
    }

    const pc = peerConnections[peerId]
    if (!expectedClose && !dataChannels[peerId] && shouldCreateInitialDataChannel(peerId) && hasParticipant(peerId) && pc && pc.signalingState !== 'closed' && pc.connectionState !== 'closed') {
      ensureDataChannel(peerId, pc)
      queueSharedNegotiation(peerId)
    }
  }

  channel.onerror = (error) => {
    if (isExpectedDataChannelAbortError(error, channel)) {
      return
    }

    console.error('数据通道错误:', error)
  }
}

function ensureDataChannel(peerId, pc) {
  const currentChannel = dataChannels[peerId]
  if (currentChannel && currentChannel.readyState !== 'closed') {
    return currentChannel
  }

  const channel = pc.createDataChannel('room-share', { ordered: true })
  registerDataChannel(peerId, channel)
  return channel
}

function syncLocalTracksToPeer(peerId) {
  const pc = peerConnections[peerId]
  const stream = localMediaStream.value

  if (!pc) {
    return
  }

  const senderCache = localTrackSenders[peerId] || ensurePeerSenderCache(localTrackSenders, peerId)
  const tracksByKind = (stream?.getTracks() || []).reduce((result, track) => {
    result[track.kind] = track
    return result
  }, {})

  ;['audio', 'video'].forEach((kind) => {
    const track = tracksByKind[kind] || null
    const sender = senderCache[kind]

    if (sender) {
      if (sender.track !== track) {
        sender.replaceTrack(track).catch((error) => {
          console.error('同步本地轨道失败:', error)
        })
      }
      applySenderVideoQualityProfile(sender, getMeshVideoQualityProfile())
      return
    }

    if (track) {
      senderCache[kind] = pc.addTrack(track, stream)
      applySenderVideoQualityProfile(senderCache[kind], getMeshVideoQualityProfile())
    }
  })
}

function detachLocalTracksFromPeer(peerId) {
  const senderCache = localTrackSenders[peerId]
  if (!senderCache) {
    return
  }

  Object.values(senderCache).forEach((sender) => {
    if (sender) {
      sender.replaceTrack(null).catch((error) => {
        console.error('清空本地轨道失败:', error)
      })
    }
  })
}

async function negotiatePeer(peerId) {
  const pc = peerConnections[peerId]
  if (!pc || pc.signalingState === 'closed') {
    return
  }

  try {
    makingOffer[peerId] = true
    const offer = await pc.createOffer()
    if (pc.signalingState !== 'stable') {
      return
    }

    await pc.setLocalDescription(offer)

    socket.value?.emit('signal', {
      roomId: roomId.value,
      targetId: peerId,
      description: pc.localDescription
    })
  } catch (error) {
    console.error('创建 Offer 失败:', error)
  } finally {
    makingOffer[peerId] = false
  }
}

function ensurePeerConnection(peerId, options = {}) {
  if (!peerId || peerId === selfId.value) {
    return null
  }

  if (peerConnections[peerId]) {
    if (options.allowInitialDataChannel) {
      ensureDataChannel(peerId, peerConnections[peerId])
    }
    if (activeShare.value?.ownerId === selfId.value && isStreamShare(activeShare.value)) {
      attachSharedStreamToPeer(peerId)
    }
    return peerConnections[peerId]
  }

  const pc = new RTCPeerConnection(RTC_CONFIGURATION)
  peerConnections[peerId] = pc
  makingOffer[peerId] = false
  ignoreOffer[peerId] = false
  isSettingRemoteAnswerPending[peerId] = false

  pc.onicecandidate = ({ candidate }) => {
    if (!candidate) {
      return
    }

    socket.value?.emit('signal', {
      roomId: roomId.value,
      targetId: peerId,
      candidate
    })
  }

  pc.ontrack = ({ streams }) => {
    if (streams?.[0]) {
      const [stream] = streams
      rememberPeerStream(peerId, stream)
      if (tryBindSharedIncomingStream(peerId)) {
        refreshPeerDisplayStream(peerId)
        return
      }
      refreshPeerDisplayStream(peerId)
    }
  }

  pc.ondatachannel = ({ channel }) => {
    registerDataChannel(peerId, channel)
  }

  pc.onnegotiationneeded = async () => {
    await negotiatePeer(peerId)
  }

  pc.onconnectionstatechange = () => {
    if (pc.connectionState === 'connected' && activeShare.value?.ownerId === selfId.value) {
      ensureShareDelivery(peerId)
      return
    }

    if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
      prunePeerStreams(peerId)

      if (activeShare.value?.ownerId === peerId && isStreamShare(activeShare.value)) {
        tryBindSharedIncomingStream(peerId)
        requestShareSync(activeShare.value.id)
      }
    }
  }

  if (options.allowInitialDataChannel) {
    ensureDataChannel(peerId, pc)
  }

  syncLocalTracksToPeer(peerId)
  if (activeShare.value?.ownerId === selfId.value && isStreamShare(activeShare.value)) {
    attachSharedStreamToPeer(peerId)
  }

  return pc
}

async function handleSignal(payload) {
  const senderId = payload.senderId
  const pc = ensurePeerConnection(senderId, { allowInitialDataChannel: false })
  if (!pc) {
    return
  }

  try {
    if (payload.description) {
      const offerCollision = payload.description.type === 'offer'
        && (makingOffer[senderId] || pc.signalingState !== 'stable')

      ignoreOffer[senderId] = !isPolitePeer(senderId) && offerCollision
      if (ignoreOffer[senderId]) {
        return
      }

      if (offerCollision && isPolitePeer(senderId)) {
        await pc.setLocalDescription({ type: 'rollback' })
      }

      isSettingRemoteAnswerPending[senderId] = payload.description.type === 'answer'
      await pc.setRemoteDescription(payload.description)
      isSettingRemoteAnswerPending[senderId] = false

      if (payload.description.type === 'offer') {
        syncLocalTracksToPeer(senderId)
        const answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)
        socket.value?.emit('signal', {
          roomId: roomId.value,
          targetId: senderId,
          description: pc.localDescription
        })
      }
      return
    }

    if (payload.candidate) {
      try {
        await pc.addIceCandidate(payload.candidate)
      } catch (error) {
        if (!ignoreOffer[senderId]) {
          console.error('添加 ICE 候选失败:', error)
        }
      }
    }
  } catch (error) {
    console.error('处理信令失败:', error)
  }
}

function removeParticipant(peerId) {
  updateParticipants(participants.value.filter((peer) => peer.id !== peerId))
}

function upsertParticipant(peer) {
  const existing = participants.value.find((item) => item.id === peer.id)
  const next = participants.value.filter((item) => item.id !== peer.id)
  next.push({
    ...existing,
    ...peer,
    isAdmin: Boolean(existing?.isAdmin || peer.isAdmin),
    isSuperAdmin: Boolean(existing?.isSuperAdmin || peer.isSuperAdmin),
    isController: Boolean(existing?.isController || peer.isController)
  })
  updateParticipants(next)
}

function cleanupPeerConnection(peerId) {
  const videoElement = remoteVideoElements[peerId]
  if (videoElement) {
    videoElement.srcObject = null
  }

  const channel = dataChannels[peerId]
  if (channel) {
    try {
      channel.__expectedClose = true
      channel.close()
    } catch (error) {
      console.error('关闭数据通道失败:', error)
    }
    delete dataChannels[peerId]
  }

  const pc = peerConnections[peerId]
  if (pc) {
    try {
      pc.close()
    } catch (error) {
      console.error('关闭 PeerConnection 失败:', error)
    }
    delete peerConnections[peerId]
  }

  delete remoteStreams[peerId]
  delete remoteVideoElements[peerId]
  delete peerStreamCatalog[peerId]
  delete localTrackSenders[peerId]
  delete sharedTrackSenders[peerId]
  delete makingOffer[peerId]
  delete ignoreOffer[peerId]
  delete isSettingRemoteAnswerPending[peerId]
  delete pendingBinaryHeaders[peerId]
}

function stopLocalStream() {
  if (!localMediaStream.value) {
    updateLocalMediaFlags()
    return
  }

  localMediaStream.value.getTracks().forEach((track) => track.stop())
  localMediaStream.value = null
  updateLocalMediaFlags()
}

function cleanupSession() {
  clearActiveShare()
  stopLocalStream()
  isSpeakerOn.value = false
  setRemoteControlState('', '')
  setGameInvite(null)
  setGameState(null)
  showGameMenu.value = false

  Object.keys(peerConnections).forEach((peerId) => {
    cleanupPeerConnection(peerId)
  })

  participants.value = []
  if (socket.value) {
    socket.value.removeAllListeners()
    socket.value.disconnect()
    socket.value = null
  }
}

function connectSocket() {
  socket.value = io(SIGNAL_SERVER_URL, {
    transports: ['polling', 'websocket']
  })

  socket.value.on('connect', () => {
    selfId.value = socket.value.id
    isConnected.value = true
    socket.value.emit('join-room', {
      roomId: roomId.value,
      userName: displayName.value,
      avatarId: avatarId.value,
      clientId,
      requestAdmin: requestedAdmin.value
    })
  })

  socket.value.on('disconnect', () => {
    isConnected.value = false
    setRemoteControlState('', '')
    if (!hasRequestedLeave.value) {
      pushSystemMessage('连接已断开，正在尝试重连...')
    }
  })

  socket.value.on('room-state', ({
    selfId: incomingId,
    participants: nextParticipants,
    sharedMedia,
    gameInvite: incomingGameInvite,
    gameState: incomingGameState,
    controllerSocketId,
    controllerTargetSocketId
  }) => {
    selfId.value = incomingId
    updateParticipants(nextParticipants || [])
    setRemoteControlState(controllerSocketId, controllerTargetSocketId)
    setGameInvite(incomingGameInvite)
    setGameState(incomingGameState)

    if ((nextParticipants || []).some((peer) => peer.id === incomingId && peer.isAdmin)) {
      requestedAdmin.value = true
      rememberAdminRoom(roomId.value)
    }

    if (!hasJoinedRoom.value) {
      pushSystemMessage(`已加入房间 ${roomId.value}`)
      hasJoinedRoom.value = true
    }

    otherParticipants.value.forEach((peer) => {
      ensurePeerConnection(peer.id, {
        allowInitialDataChannel: shouldCreateInitialDataChannel(peer.id)
      })
    })

    if (sharedMedia) {
      openIncomingShare(sharedMedia)
      if (sharedMedia.ownerId !== selfId.value) {
        requestShareSync(sharedMedia.id)
      }
    }
  })

  socket.value.on('participants-changed', ({ participants: nextParticipants }) => {
    updateParticipants(nextParticipants || [])

    if ((nextParticipants || []).some((peer) => peer.id === selfId.value && peer.isAdmin)) {
      requestedAdmin.value = true
      rememberAdminRoom(roomId.value)
    }
  })

  socket.value.on('peer-joined', ({ peer }) => {
    upsertParticipant(peer)
    pushSystemMessage(`${peer.name} 加入了房间`)
    ensurePeerConnection(peer.id, {
      allowInitialDataChannel: shouldCreateInitialDataChannel(peer.id)
    })

    if (activeShare.value?.ownerId === selfId.value) {
      markShareDeliveryPending(peer.id, activeShare.value.id)
      ensureShareDelivery(peer.id)
    }
  })

  socket.value.on('admin-changed', ({ adminId, adminName }) => {
    if (adminId === selfId.value) {
      requestedAdmin.value = true
      rememberAdminRoom(roomId.value)
      pushSystemMessage('你现在是房主，可以共享和控制内容')
      return
    }

    if (adminName) {
      pushSystemMessage(`${adminName} 现在是房主`)
    }
  })

  socket.value.on('remote-control-requested', ({ requesterId, requesterName, targetId, targetName }) => {
    if (targetId !== selfId.value || requesterId === selfId.value) {
      return
    }

    const accepted = window.confirm(`${requesterName || '房间成员'} 想控制你的屏幕“${targetName || '当前共享'}”，是否授权？`)
    if (!accepted) {
      return
    }

    socket.value?.emit('remote-control-set', {
      roomId: roomId.value,
      targetId: selfId.value,
      controllerId: requesterId
    })
  })

  socket.value.on('remote-control-changed', ({ controllerId, controllerName, targetId, targetName }) => {
    setRemoteControlState(controllerId, targetId)
    setActiveSharePointer(null)

    if (controllerId === selfId.value) {
      pushSystemMessage(targetName ? `你已获得 ${targetName} 的远控权限` : '你已获得远控权限')
      return
    }

    if (targetId === selfId.value && controllerName) {
      pushSystemMessage(`${controllerName} 已接入你的屏幕远控`)
      return
    }

    if (!controllerId) {
      pushSystemMessage('远控权限已释放')
      return
    }

    if (controllerName) {
      pushSystemMessage(targetName ? `${controllerName} 正在远控 ${targetName}` : `${controllerName} 已获得远控权限`)
    }
  })

  socket.value.on('peer-left', ({ peerId, peerName }) => {
    removeParticipant(peerId)
    cleanupPeerConnection(peerId)
    pushSystemMessage(`${peerName || '房间成员'} 离开了房间`)
  })

  socket.value.on('signal', handleSignal)

  socket.value.on('room-message', ({ message }) => {
    pushMessage(message)
  })

  socket.value.on('game-invite-updated', ({ invite }) => {
    setGameInvite(invite)
  })

  socket.value.on('game-invite-responded', (payload = {}) => {
    const gameLabel = getGameTypeLabel(payload.gameType)

    if (payload.accepted) {
      if (!payload.completed && payload.respondedByName) {
        pushSystemMessage(`${payload.respondedByName} 已接受${gameLabel}邀请`)
      }
      return
    }

    if (payload.cancelled) {
      pushSystemMessage(`${payload.cancelledByName || '房间成员'} 取消了${gameLabel}邀请`)
      return
    }

    pushSystemMessage(`${payload.respondedByName || '房间成员'} 拒绝了${gameLabel}邀请`)
  })

  socket.value.on('game-state-updated', ({ gameState }) => {
    const previousGame = activeGame.value
    setGameState(gameState)

    if (!gameState) {
      if (!gameInvite.value) {
        showGameMenu.value = false
      }
      return
    }

    if (gameState.gameType === 'landlord') {
      const nextHandIdSet = new Set((gameState.myHand || []).map((card) => card.id))
      selectedLandlordCardIds.value = selectedLandlordCardIds.value.filter((cardId) => nextHandIdSet.has(cardId))
    }

    if (!previousGame || previousGame.id !== gameState.id) {
      selectedLandlordCardIds.value = []

      if (gameState.gameType === 'landlord') {
        pushSystemMessage(`斗地主开始：${formatNameList((gameState.players || []).map((player) => player.name))} 已入座`)
        return
      }

      pushSystemMessage(`五子棋开始：${gameState.blackName} 执黑，${gameState.whiteName} 执白`)
      return
    }

    if (gameState.gameType === 'landlord') {
      if (previousGame.status !== 'finished' && gameState.status === 'finished') {
        if (gameState.endedReason === 'player-left') {
          pushSystemMessage(`斗地主结束：${gameState.winnerName || '剩余成员'} 因对手离房获胜`)
          return
        }

        if (gameState.winningSide === 'landlord') {
          pushSystemMessage(`斗地主结束：地主方 ${gameState.landlordName || gameState.winnerName || '房间成员'} 获胜`)
          return
        }

        if (gameState.winningSide === 'farmers') {
          pushSystemMessage(`斗地主结束：农民方 ${formatNameList(gameState.winnerNames || []) || '房间成员'} 获胜`)
          return
        }

        pushSystemMessage(`斗地主结束：${gameState.winnerName || '房间成员'} 获胜`)
      }
      return
    }

    if (previousGame.status !== 'finished' && gameState.status === 'finished') {
      if (gameState.endedReason === 'draw') {
        pushSystemMessage('五子棋本局战平')
        return
      }

      if (gameState.endedReason === 'resign') {
        pushSystemMessage(`五子棋结束：${gameState.winnerName || '房间成员'} 因对手认输获胜`)
        return
      }

      if (gameState.endedReason === 'player-left') {
        pushSystemMessage(`五子棋结束：${gameState.winnerName || '房间成员'} 因对手离房获胜`)
        return
      }

      pushSystemMessage(`五子棋结束：${gameState.winnerName || '房间成员'} 获胜`)
    }
  })

  socket.value.on('share-started', ({ media }) => {
    openIncomingShare(media)
    if (media?.deliveryMode === 'livekit' && media.ownerId !== selfId.value) {
      connectIncomingLivekitShare(media)
    }
    pushSystemMessage(`${media.ownerName} 共享了${getShareKindLabel(media.kind)} ${media.fileName}`)
    requestShareSync(media.id)
  })

  socket.value.on('share-control', ({ mediaId, sync, zoomed, senderId }) => {
    if (!activeShare.value || activeShare.value.id !== mediaId) {
      return
    }

    updateActiveShare({
      zoomed: typeof zoomed === 'boolean' ? zoomed : activeShare.value.zoomed,
      sync: sync || activeShare.value.sync,
      controllerId: sync?.controllerId || senderId || activeShare.value.controllerId
    })

    if (activeShare.value.kind === 'video') {
      applyVideoSync(sync, sync?.action === 'seek')
    }
  })

  socket.value.on('remote-pointer', ({ mediaId, pointer, senderName }) => {
    if (!activeShare.value || activeShare.value.id !== mediaId || activeShare.value.kind !== 'screen') {
      return
    }

    setActiveSharePointer({
      ...pointer,
      name: senderName || pointer?.name || '远控指针'
    })
  })

  socket.value.on('remote-control-command', ({ mediaId, command, senderName }) => {
    if (
      !activeShare.value
      || activeShare.value.id !== mediaId
      || activeShare.value.kind !== 'screen'
      || activeShare.value.ownerId !== selfId.value
    ) {
      return
    }

    showRemoteCommandOverlay(command, senderName)
    forwardRemoteControlCommandToAgent(command, senderName)
  })

  socket.value.on('share-closed', ({ mediaId, senderName, reason }) => {
    if (mediaId && activeShare.value?.id !== mediaId) {
      return
    }

    const suffix = reason === 'owner-left' ? '（共享者已离开）' : ''
    clearActiveShare()
    setRemoteControlState('', '')
    pushSystemMessage(`${senderName || '房间成员'} 关闭了共享${suffix}`)
  })

  socket.value.on('room-closed', (payload) => {
    pushSystemMessage(payload.message || '房间已关闭')
    setTimeout(() => {
      cleanupSession()
      router.push('/')
    }, 1500)
  })

  socket.value.on('admin-granted', (payload) => {
    pushSystemMessage(`${payload.grantedByName} 已授予 ${payload.targetName} 管理员权限`)
  })

  socket.value.on('admin-revoked', (payload) => {
    if (payload.targetId === selfId.value) {
      requestedAdmin.value = false
      forgetAdminRoom(roomId.value)
    }
    pushSystemMessage(`${payload.revokedByName} 已撤销 ${payload.targetName} 的管理员权限`)
  })

  socket.value.on('webpage-share', (payload) => {
    if (payload.ownerId === selfId.value) {
      return
    }

    webpageLoaded.value = false

    closeSharedMedia()

    updateActiveShare({
      id: payload.mediaId,
      kind: 'webpage',
      fileName: payload.fileName,
      fileType: 'webpage',
      fileSize: 0,
      ownerId: payload.ownerId,
      ownerName: payload.ownerName,
      url: payload.url,
      webpageReloadToken: Number(payload.reloadToken || Date.now()),
      webpageHistory: payload.webpageHistory || undefined,
      webpageActiveIndex: Number(payload.webpageActiveIndex || 0),
      progress: 100
    })

    pushSystemMessage(`${payload.ownerName} 共享了网页: ${payload.fileName}`)
  })

  socket.value.on('webpage-share-closed', (payload) => {
    if (activeShare.value?.id === payload.mediaId) {
      clearActiveShare()
      pushSystemMessage(`${payload.senderName} 关闭了网页共享`)
    }
  })

  socket.value.on('share-resync-request', ({ targetId, mediaId }) => {
    if (activeShare.value?.ownerId !== selfId.value || activeShare.value.id !== mediaId) {
      return
    }

    markShareDeliveryPending(targetId, mediaId)
    ensureShareDelivery(targetId, true)
  })

  socket.value.on('permission-denied', ({ message }) => {
    if (message) {
      alert(message)
    }
  })
}

function openWebpageShareDialog() {
  if (!isConnected.value) {
    alert('连接尚未建立，请稍后再试')
    return
  }
  if (!canShare.value) {
    alert('仅房主可以共享网页')
    return
  }
  webpageUrlInput.value = ''
  showWebpageDialog.value = true
  nextTick(() => {
    webpageUrlInputRef.value?.focus()
  })
}

function closeWebpageShareDialog() {
  showWebpageDialog.value = false
  webpageUrlInput.value = ''
}

function getWebpageShareFileName(url) {
  try {
    const urlObj = new URL(url)
    return `${urlObj.hostname}${urlObj.pathname}${urlObj.search}` || urlObj.hostname
  } catch {
    return url
  }
}

const MAX_WEBPAGE_HISTORY = 5

function createWebpageHistoryEntry(url, fileName = getWebpageShareFileName(url), reloadToken = Date.now()) {
  return {
    id: createId('webpage_entry_'),
    url,
    fileName,
    reloadToken: Number(reloadToken || Date.now())
  }
}

function getWebpageHistoryEntries(share = activeShare.value) {
  if (!share || share.kind !== 'webpage') {
    return []
  }

  const sourceEntries = Array.isArray(share.webpageHistory) && share.webpageHistory.length
    ? share.webpageHistory
    : (share.url ? [createWebpageHistoryEntry(share.url, share.fileName, share.webpageReloadToken)] : [])

  return sourceEntries
    .map((entry) => {
      const url = typeof entry?.url === 'string' ? entry.url.trim() : ''
      if (!url) {
        return null
      }

      return {
        id: entry?.id || createId('webpage_entry_'),
        url,
        fileName: entry?.fileName || getWebpageShareFileName(url),
        reloadToken: Number(entry?.reloadToken || Date.now())
      }
    })
    .filter(Boolean)
    .slice(-MAX_WEBPAGE_HISTORY)
}

function getActiveWebpageHistoryIndex(share = activeShare.value) {
  const entries = getWebpageHistoryEntries(share)
  if (!entries.length) {
    return -1
  }

  return Math.min(Math.max(Number(share?.webpageActiveIndex || 0), 0), entries.length - 1)
}

function getActiveWebpageHistoryEntry(share = activeShare.value) {
  const entries = getWebpageHistoryEntries(share)
  const activeIndex = getActiveWebpageHistoryIndex(share)
  return activeIndex >= 0 ? entries[activeIndex] : null
}

function getWebpageIframeKey(share = activeShare.value, entry = getActiveWebpageHistoryEntry(share), index = getActiveWebpageHistoryIndex(share)) {
  const shareId = share?.id || 'webpage'
  const entryId = entry?.id || `entry_${index}`
  const reloadToken = Number(entry?.reloadToken || share?.webpageReloadToken || 0)
  return `${shareId}:${entryId}:${reloadToken}`
}

function syncActiveWebpageLoadedState(share = activeShare.value) {
  const activeEntry = getActiveWebpageHistoryEntry(share)
  if (!activeEntry) {
    webpageLoaded.value = false
    return
  }

  webpageLoaded.value = Boolean(webpageIframeLoadState[getWebpageIframeKey(share, activeEntry)])
}

function commitSharedWebpageState(entries, activeIndex, options = {}) {
  const trimmedEntries = entries.slice(-MAX_WEBPAGE_HISTORY)
  const droppedCount = Math.max(entries.length - trimmedEntries.length, 0)
  const normalizedActiveIndex = Math.min(
    Math.max(activeIndex - droppedCount, 0),
    Math.max(trimmedEntries.length - 1, 0)
  )
  const activeEntry = trimmedEntries[normalizedActiveIndex]
  if (!activeEntry) {
    return
  }

  const shareId = options.mediaId || activeShare.value?.id || `webpage-${Date.now()}`
  const ownerId = options.ownerId || activeShare.value?.ownerId || selfId.value
  const ownerName = options.ownerName || activeShare.value?.ownerName || displayName.value
  const shouldBroadcast = options.broadcast ?? canGlobalControlShare.value

  updateActiveShare({
    id: shareId,
    kind: 'webpage',
    fileName: activeEntry.fileName,
    fileType: 'webpage',
    fileSize: 0,
    ownerId,
    ownerName,
    url: activeEntry.url,
    webpageReloadToken: activeEntry.reloadToken,
    webpageHistory: trimmedEntries,
    webpageActiveIndex: normalizedActiveIndex,
    progress: 100
  })

  if (shouldBroadcast && socket.value?.connected) {
    socket.value.emit('webpage-share', {
      roomId: roomId.value,
      mediaId: shareId,
      ownerId,
      ownerName,
      url: activeEntry.url,
      fileName: activeEntry.fileName,
      reloadToken: activeEntry.reloadToken,
      webpageHistory: trimmedEntries,
      webpageActiveIndex: normalizedActiveIndex
    })
  }
}

function goBackSharedWebpage() {
  if (!canStepBackwardSharedWebpage.value) {
    return
  }

  const entries = getWebpageHistoryEntries(activeShare.value)
  const activeIndex = getActiveWebpageHistoryIndex(activeShare.value)
  const nextIndex = activeIndex <= 0 ? entries.length - 1 : activeIndex - 1
  commitSharedWebpageState(entries, nextIndex)
}

function goForwardSharedWebpage() {
  if (!canStepForwardSharedWebpage.value) {
    return
  }

  const entries = getWebpageHistoryEntries(activeShare.value)
  const activeIndex = getActiveWebpageHistoryIndex(activeShare.value)
  const nextIndex = activeIndex >= entries.length - 1 ? 0 : activeIndex + 1
  commitSharedWebpageState(entries, nextIndex)
}

function refreshSharedWebpage() {
  if (!canRefreshSharedWebpage.value) {
    return
  }

  webpageLoaded.value = false
  const entries = getWebpageHistoryEntries(activeShare.value)
  const activeIndex = getActiveWebpageHistoryIndex(activeShare.value)
  const nextEntries = entries.map((entry, index) => index === activeIndex ? { ...entry, reloadToken: Date.now() } : entry)
  commitSharedWebpageState(nextEntries, activeIndex)
}

function confirmWebpageShare() {
  const url = webpageUrlInput.value.trim()
  if (!isValidWebpageUrl.value) {
    alert('请输入有效的网页地址')
    return
  }

  const fileName = getWebpageShareFileName(url)
  const reloadToken = Date.now()
  const historyEntry = createWebpageHistoryEntry(url, fileName, reloadToken)
  const reusingWebpageShare = activeShare.value?.kind === 'webpage'
  const shareId = reusingWebpageShare ? activeShare.value.id : `webpage-${Date.now()}`
  let entries = []

  if (!reusingWebpageShare) {
    closeSharedMedia()
    entries = [historyEntry]
  } else {
    entries = [...getWebpageHistoryEntries(activeShare.value), historyEntry]
  }

  webpageLoaded.value = false
  commitSharedWebpageState(entries, entries.length - 1, { mediaId: shareId })

  closeWebpageShareDialog()
  pushSystemMessage(`开始共享网页: ${fileName}`)
}

function handleWebpageLoad(entry, index) {
  const key = getWebpageIframeKey(activeShare.value, entry, index)
  webpageIframeLoadState[key] = true
  if (index === getActiveWebpageHistoryIndex(activeShare.value)) {
    webpageLoaded.value = true
  }
}

function handleWebpageError(entry, index) {
  const key = getWebpageIframeKey(activeShare.value, entry, index)
  webpageIframeLoadState[key] = true
  if (index === getActiveWebpageHistoryIndex(activeShare.value)) {
    webpageLoaded.value = true
  }
  pushSystemMessage('网页加载失败，该网站可能禁止在iframe中嵌入')
}

function chooseMedia() {
  if (!isConnected.value) {
    alert('连接尚未建立，请稍后再试')
    return
  }
  if (!canShare.value) {
    alert('仅房主可以共享文件')
    return
  }
  fileInputRef.value?.click()
}

function handleFileChange(event) {
  const file = event.target.files?.[0]
  event.target.value = ''

  if (!file) {
    return
  }

  if (!canShare.value) {
    alert('仅房主可以共享文件')
    return
  }

  const kind = file.type.startsWith('image/')
    ? 'image'
    : file.type.startsWith('video/')
      ? 'video'
      : ''

  if (!kind) {
    alert('目前只支持图片和视频文件')
    return
  }

  if (!file.size) {
    alert('文件为空，无法共享')
    return
  }

  if (kind === 'video' && supportsStreamVideoShare()) {
    startRealtimeVideoShare(file)
    return
  }

  startFileShare(file, kind)
}

function inviteToGomoku(peer) {
  if (!socket.value?.connected || !peer?.id || !canInviteGomoku.value) {
    return
  }

  socket.value.emit('game-invite-send', {
    roomId: roomId.value,
    gameType: 'gomoku',
    inviteeId: peer.id
  })
}

function inviteToLandlord() {
  if (!socket.value?.connected || !canInviteLandlord.value) {
    return
  }

  socket.value.emit('game-invite-send', {
    roomId: roomId.value,
    gameType: 'landlord',
    inviteeIds: selectedLandlordPeers.value.map((peer) => peer.id)
  })
}

function cancelGameInvite() {
  if (!socket.value?.connected || !gameInvite.value) {
    return
  }

  socket.value.emit('game-invite-cancel', {
    roomId: roomId.value,
    inviteId: gameInvite.value.id
  })
}

function respondToGameInvite(accepted) {
  if (!socket.value?.connected || !gameInvite.value || !isPendingInviteForMe.value) {
    return
  }

  socket.value.emit('game-invite-respond', {
    roomId: roomId.value,
    inviteId: gameInvite.value.id,
    accepted
  })
}

function placeGomokuStone(row, col) {
  if (!socket.value?.connected || !canPlaceGomokuStone(row, col)) {
    return
  }

  socket.value.emit('game-move', {
    roomId: roomId.value,
    row,
    col
  })
}

function bidLandlordScore(score) {
  if (!socket.value?.connected || !canBidLandlord.value) {
    return
  }

  socket.value.emit('landlord-bid', {
    roomId: roomId.value,
    score
  })
}

function playSelectedLandlordCards() {
  if (!socket.value?.connected || !canPlayLandlordCards.value) {
    return
  }

  socket.value.emit('landlord-play', {
    roomId: roomId.value,
    cardIds: selectedLandlordCards.value.map((card) => card.id)
  })
}

function passLandlordTurn() {
  if (!socket.value?.connected || !canPassLandlordTurn.value) {
    return
  }

  socket.value.emit('landlord-pass', {
    roomId: roomId.value
  })
}

function resignGomokuGame() {
  if (!socket.value?.connected || activeGame.value?.status !== 'playing' || !isPlayingGomoku.value) {
    return
  }

  socket.value.emit('game-resign', {
    roomId: roomId.value,
    gameId: activeGame.value.id
  })
}

function closeActiveGame() {
  if (!socket.value?.connected || !activeGame.value || !canCloseActiveGame.value) {
    return
  }

  socket.value.emit('game-close', {
    roomId: roomId.value,
    gameId: activeGame.value.id
  })
}

function closeGameStage() {
  if (!socket.value?.connected || !canCloseGameStage.value) {
    return
  }

  if (!activeGame.value && !gameInvite.value) {
    toggleGameMenu()
    return
  }

  socket.value?.emit('game-stage-close', {
    roomId: roomId.value
  })
}

function canManagePeerRemoteControl(peer) {
  return Boolean(
    peer?.id
    && isSharingScreen.value
    && isShareOwner.value
    && peer.id !== selfId.value
  )
}

function canRequestPeerRemoteControl(peer) {
  return Boolean(
    peer?.id
    && canRequestRemoteControl.value
    && activeShare.value?.ownerId === peer.id
  )
}

function requestRemoteControl(targetId = activeShare.value?.ownerId) {
  if (!socket.value?.connected || !targetId || targetId === selfId.value || !isSharingScreen.value) {
    return
  }

  socket.value.emit('remote-control-request', {
    roomId: roomId.value,
    targetId
  })
  const targetName = participants.value.find((peer) => peer.id === targetId)?.name || activeShare.value?.ownerName || '对方'
  pushSystemMessage(`已向 ${targetName} 发送远控申请`)
}

function releaseRemoteControl() {
  if (!socket.value?.connected || (!isRemoteController.value && !isRemoteControlTarget.value && !isShareOwner.value)) {
    return
  }

  socket.value.emit('remote-control-release', {
    roomId: roomId.value
  })
}

function togglePeerRemoteControl(peer) {
  if (!socket.value?.connected || !peer?.id || !isSharingScreen.value || activeShare.value?.ownerId !== selfId.value) {
    return
  }

  socket.value.emit('remote-control-set', {
    roomId: roomId.value,
    targetId: selfId.value,
    controllerId: peer.isController ? null : peer.id
  })
}

function sendMessage() {
  const content = inputMessage.value.trim()
  if (!content || !socket.value?.connected) {
    return
  }

  const message = {
    id: createId('msg_'),
    kind: 'text',
    senderId: selfId.value,
    senderName: displayName.value,
    senderAvatarId: avatarId.value,
    content,
    timestamp: Date.now()
  }

  pushMessage(message)
  inputMessage.value = ''

  socket.value.emit('room-message', {
    roomId: roomId.value,
    message
  })
}

function emitRemotePointer(pointer) {
  if (
    showGameStage.value
    || !socket.value?.connected
    || activeShare.value?.kind !== 'screen'
    || !canControlShare.value
  ) {
    return
  }

  setActiveSharePointer({
    ...pointer,
    name: displayName.value
  })

  socket.value.emit('remote-pointer', {
    roomId: roomId.value,
    mediaId: activeShare.value.id,
    pointer
  })
}

function handleSharedStagePointerMove(event) {
  if (
    showGameStage.value
    || !socket.value?.connected
    || activeShare.value?.kind !== 'screen'
    || !canControlShare.value
    || !sharedStageRef.value
  ) {
    return
  }

  const now = Date.now()
  if (now - lastRemotePointerSentAt.value < 40) {
    return
  }
  lastRemotePointerSentAt.value = now

  const bounds = sharedStageRef.value.getBoundingClientRect()
  if (!bounds.width || !bounds.height) {
    return
  }

  const x = (event.clientX - bounds.left) / bounds.width
  const y = (event.clientY - bounds.top) / bounds.height

  emitRemotePointer({
    x: Math.min(Math.max(x, 0), 1),
    y: Math.min(Math.max(y, 0), 1),
    visible: true
  })
}

function handleSharedStagePointerLeave() {
  if (showGameStage.value || activeShare.value?.kind !== 'screen' || !canControlShare.value) {
    return
  }

  emitRemotePointer({
    ...(activeShare.value?.pointer || {}),
    visible: false
  })
}

function handleSharedStageMouseDown() {
  if (showGameStage.value || !canSendRemoteControlCommands.value) {
    return
  }

  sharedStageRef.value?.focus?.()
}

function getSharedStagePoint(event) {
  if (!sharedStageRef.value) {
    return null
  }

  const bounds = sharedStageRef.value.getBoundingClientRect()
  if (!bounds.width || !bounds.height) {
    return null
  }

  return {
    x: Math.min(Math.max((event.clientX - bounds.left) / bounds.width, 0), 1),
    y: Math.min(Math.max((event.clientY - bounds.top) / bounds.height, 0), 1)
  }
}

function emitRemoteControlCommand(command) {
  if (
    showGameStage.value
    || !socket.value?.connected
    || !activeShare.value
    || !canSendRemoteControlCommands.value
  ) {
    return
  }

  socket.value.emit('remote-control-command', {
    roomId: roomId.value,
    mediaId: activeShare.value.id,
    targetId: remoteControlTargetId.value || activeShare.value.ownerId,
    command
  })
}

function handleSharedStageClick(event) {
  if (showGameStage.value || !canSendRemoteControlCommands.value) {
    return
  }

  const point = getSharedStagePoint(event)
  if (!point) {
    return
  }

  event.preventDefault()
  emitRemoteControlCommand({
    type: 'click',
    ...point
  })
}

function handleSharedStageDoubleClick(event) {
  if (showGameStage.value || !canSendRemoteControlCommands.value) {
    return
  }

  const point = getSharedStagePoint(event)
  if (!point) {
    return
  }

  event.preventDefault()
  emitRemoteControlCommand({
    type: 'double-click',
    ...point
  })
}

function handleSharedStageContextMenu(event) {
  if (showGameStage.value || !canSendRemoteControlCommands.value) {
    return
  }

  const point = getSharedStagePoint(event)
  if (!point) {
    return
  }

  event.preventDefault()
  emitRemoteControlCommand({
    type: 'contextmenu',
    ...point
  })
}

function handleSharedStageWheel(event) {
  if (showGameStage.value || !canSendRemoteControlCommands.value) {
    return
  }

  const point = getSharedStagePoint(event)
  if (!point) {
    return
  }

  event.preventDefault()
  emitRemoteControlCommand({
    type: 'wheel',
    ...point,
    deltaX: event.deltaX,
    deltaY: event.deltaY
  })
}

function handleSharedStageKeydown(event) {
  if (showGameStage.value || !canSendRemoteControlCommands.value || event.isComposing) {
    return
  }

  event.preventDefault()
  emitRemoteControlCommand({
    type: 'keydown',
    key: event.key,
    code: event.code,
    ctrlKey: event.ctrlKey,
    shiftKey: event.shiftKey,
    altKey: event.altKey,
    metaKey: event.metaKey,
    x: activeShare.value?.pointer?.x ?? 0.5,
    y: activeShare.value?.pointer?.y ?? 0.5
  })
}

function emitShareControl(action, extra = {}) {
  if (!socket.value?.connected || !activeShare.value || !canManageSharedMedia.value) {
    return
  }

  const payload = {
    roomId: roomId.value,
    mediaId: activeShare.value.id,
    action
  }

  if (activeShare.value.kind === 'video') {
    const video = sharedVideoRef.value
    const controllerId = isStreamShare(activeShare.value) && activeShare.value.ownerId !== selfId.value
      ? activeShare.value.ownerId
      : selfId.value
    payload.currentTime = extra.currentTime ?? video?.currentTime ?? 0
    payload.playing = extra.playing ?? Boolean(video && !video.paused && !video.ended)
    payload.duration = extra.duration ?? Number(video?.duration || activeShare.value.sync?.duration || 0)
    payload.muted = extra.muted ?? sharedVideoMuted.value

    updateActiveShare({
      controllerId,
      sync: {
        action,
        currentTime: payload.currentTime,
        playing: payload.playing,
        duration: payload.duration,
        muted: payload.muted,
        updatedAt: Date.now(),
        controllerId
      }
    })
    syncSharedVideoUiFromState(activeShare.value.sync)
  }

  if (typeof extra.zoomed === 'boolean') {
    payload.zoomed = extra.zoomed
    updateActiveShare({
      zoomed: extra.zoomed
    })
  }

  socket.value.emit('share-control', payload)
}

function getVideoSyncTime(sync) {
  if (!sync) {
    return 0
  }

  let targetTime = Number(sync.currentTime || 0)
  if (sync.playing && sync.updatedAt) {
    targetTime += Math.max(0, Date.now() - sync.updatedAt) / 1000
  }
  return targetTime
}

function applyVideoSync(sync, forceSeek = false) {
  const video = sharedVideoRef.value
  if (!video || !sync) {
    return
  }

  const targetTime = getVideoSyncTime(sync)
  syncSharedVideoUiFromState({
    ...sync,
    currentTime: targetTime
  })
  suppressShareEvents(sync.playing ? 1200 : 700)

  if (!canGlobalControlShare.value && sharedVideoLocalPaused.value) {
    cancelSharedVideoPlayRequest()
    video.pause()
    restartSharedVideoUiTicker()
    return
  }

  if (!shouldUseSyncedVideoUi() && Number.isFinite(targetTime) && (forceSeek || Math.abs(video.currentTime - targetTime) > 0.45)) {
    try {
      video.currentTime = Math.min(targetTime, video.duration || targetTime)
    } catch (error) {
      console.error('同步播放位置失败:', error)
    }
  }

  if (sync.playing) {
    if (video.paused || video.ended || forceSeek) {
      playSharedVideoSafely({ source: '同步播放', force: forceSeek })
    }
  } else {
    cancelSharedVideoPlayRequest()
    video.pause()
  }

  restartSharedVideoUiTicker()
}


function handleSharedVideoLoaded() {
  markIncomingStreamHealthy()
  if (sharedVideoRef.value && !shouldUseSyncedVideoUi()) {
    sharedVideoUi.duration = getResolvedSharedVideoDuration(activeShare.value?.sync)
    sharedVideoUi.currentTime = Number(sharedVideoRef.value.currentTime || 0)
    sharedVideoUi.playing = Boolean(!sharedVideoRef.value.paused && !sharedVideoRef.value.ended)
  }

  if (activeShare.value?.kind === 'video' && activeShare.value.sync) {
    applyVideoSync(activeShare.value.sync, true)
  }
}

function handleSharedVideoCanPlay() {
  markIncomingStreamHealthy()
  if (sharedVideoRef.value && !shouldUseSyncedVideoUi()) {
    sharedVideoUi.duration = getResolvedSharedVideoDuration(activeShare.value?.sync)
    sharedVideoUi.currentTime = Number(sharedVideoRef.value.currentTime || 0)
    sharedVideoUi.playing = Boolean(!sharedVideoRef.value.paused && !sharedVideoRef.value.ended)
  }

  if (activeShare.value?.kind === 'video' && activeShare.value.sync) {
    applyVideoSync(activeShare.value.sync, false)
  }
}

function handleSharedVideoPlaying() {
  markIncomingStreamHealthy()
  if (
    activeShare.value?.kind === 'video'
    && activeShare.value.ownerId === selfId.value
    && isStreamShare(activeShare.value)
    && !sharedOutgoingStream.value
  ) {
    initializeOwnedSharedVideoStream()
  }
}

function handleSharedVideoPlay() {
  if (shouldSuppressShareEvents() || activeShare.value?.kind !== 'video' || !canGlobalControlShare.value) {
    return
  }
  sharedVideoUi.playing = true
  emitShareControl('play', {
    playing: true,
    currentTime: sharedVideoRef.value?.currentTime || 0,
    duration: Number(sharedVideoRef.value?.duration || activeShare.value?.sync?.duration || 0)
  })
}

function handleSharedVideoPause() {
  if (shouldSuppressShareEvents() || activeShare.value?.kind !== 'video' || !canGlobalControlShare.value) {
    return
  }
  sharedVideoUi.playing = false
  emitShareControl('pause', {
    playing: false,
    currentTime: sharedVideoRef.value?.currentTime || 0,
    duration: Number(sharedVideoRef.value?.duration || activeShare.value?.sync?.duration || 0)
  })
}

function handleSharedVideoSeek() {
  if (shouldSuppressShareEvents() || activeShare.value?.kind !== 'video' || !canGlobalControlShare.value) {
    return
  }

  sharedVideoUi.currentTime = sharedVideoRef.value?.currentTime || 0
  emitShareControl('seek', {
    currentTime: sharedVideoRef.value?.currentTime || 0,
    playing: Boolean(sharedVideoRef.value && !sharedVideoRef.value.paused),
    duration: Number(sharedVideoRef.value?.duration || activeShare.value?.sync?.duration || 0)
  })
}

function handleSharedVideoTimeUpdate() {
  if (isStreamShare(activeShare.value) && activeShare.value?.ownerId !== selfId.value) {
    markIncomingStreamHealthy()
  }

  if (sharedVideoRef.value && !shouldUseSyncedVideoUi()) {
    sharedVideoUi.currentTime = Number(sharedVideoRef.value.currentTime || 0)
    sharedVideoUi.duration = Number(sharedVideoRef.value.duration || activeShare.value?.sync?.duration || 0)
    sharedVideoUi.playing = Boolean(!sharedVideoRef.value.paused && !sharedVideoRef.value.ended)
  }

  if (shouldSuppressShareEvents() || activeShare.value?.kind !== 'video' || !canGlobalControlShare.value) {
    return
  }

  if (activeShare.value.controllerId !== selfId.value || !sharedVideoRef.value || sharedVideoRef.value.paused) {
    return
  }

  const now = Date.now()
  if (now - lastVideoHeartbeatAt.value < 1000) {
    return
  }

  lastVideoHeartbeatAt.value = now
  emitShareControl('heartbeat', {
    currentTime: sharedVideoRef.value.currentTime,
    playing: true,
    duration: Number(sharedVideoRef.value?.duration || activeShare.value?.sync?.duration || 0)
  })
}

function toggleSharedVideoPlayback() {
  if (!canLocalControlSharedVideo.value || activeShare.value?.kind !== 'video' || !sharedVideoRef.value) {
    return
  }

  if (canGlobalControlShare.value) {
    sharedVideoLocalPaused.value = false
    if (shouldUseSyncedVideoUi()) {
      const nextPlaying = !sharedVideoUi.playing
      sharedVideoUi.playing = nextPlaying
      suppressShareEvents(500)
      if (nextPlaying) {
        playSharedVideoSafely({ source: '实时流本地播放' })
      } else {
        cancelSharedVideoPlayRequest()
        sharedVideoRef.value.pause()
      }
      emitShareControl(nextPlaying ? 'play' : 'pause', {
        playing: nextPlaying,
        currentTime: sharedVideoUi.currentTime,
        duration: sharedVideoUi.duration
      })
      return
    }

    if (sharedVideoRef.value.paused) {
      suppressShareEvents(500)
      sharedVideoUi.playing = true
      playSharedVideoSafely({ source: '视频播放' })
      emitShareControl('play', {
        playing: true,
        currentTime: sharedVideoRef.value.currentTime || 0,
        duration: Number(sharedVideoRef.value?.duration || activeShare.value?.sync?.duration || 0),
        muted: sharedVideoMuted.value
      })
      return
    }

    suppressShareEvents(500)
    sharedVideoUi.playing = false
    cancelSharedVideoPlayRequest()
    sharedVideoRef.value.pause()
    emitShareControl('pause', {
      playing: false,
      currentTime: sharedVideoRef.value.currentTime || 0,
      duration: Number(sharedVideoRef.value?.duration || activeShare.value?.sync?.duration || 0),
      muted: sharedVideoMuted.value
    })
    return
  }

  if (sharedVideoRef.value.paused) {
    sharedVideoLocalPaused.value = false
    const syncedTime = getVideoSyncTime(activeShare.value.sync)
    try {
      sharedVideoRef.value.currentTime = Math.min(syncedTime, sharedVideoRef.value.duration || syncedTime)
      sharedVideoUi.currentTime = syncedTime
      sharedVideoUi.playing = true
    } catch (error) {
      console.error('恢复本地视频进度失败:', error)
    }

    playSharedVideoSafely({ source: '本地恢复视频播放' })
    return
  }

  sharedVideoLocalPaused.value = true
  sharedVideoUi.playing = false
  cancelSharedVideoPlayRequest()
  sharedVideoRef.value.pause()
}

function handleSharedVideoProgressInput(event) {
  if (!canGlobalControlShare.value || activeShare.value?.kind !== 'video' || !sharedVideoRef.value) {
    return
  }

  const nextTime = Number(event.target.value)
  if (!Number.isFinite(nextTime)) {
    return
  }

  if (shouldUseSyncedVideoUi()) {
    sharedVideoUi.currentTime = nextTime
    emitShareControl('seek', {
      currentTime: nextTime,
      playing: sharedVideoUi.playing,
      duration: sharedVideoUi.duration
    })
    return
  }

  try {
    suppressShareEvents(500)
    sharedVideoRef.value.currentTime = nextTime
    sharedVideoUi.currentTime = nextTime
    emitShareControl('seek', {
      currentTime: nextTime,
      playing: Boolean(sharedVideoRef.value && !sharedVideoRef.value.paused),
      duration: Number(sharedVideoRef.value?.duration || activeShare.value?.sync?.duration || 0),
      muted: sharedVideoMuted.value
    })
  } catch (error) {
    console.error('设置播放进度失败:', error)
  }
}

function toggleSharedImageZoom() {
  if (!activeShare.value || activeShare.value.kind !== 'image' || shouldSuppressShareEvents() || !canManageSharedMedia.value) {
    return
  }

  emitShareControl('image-zoom', {
    zoomed: !activeShare.value.zoomed
  })
}

function closeSharedMedia(fromTrackEnded = false) {
  if (!activeShare.value || !canShare.value) {
    return
  }

  socket.value?.emit('share-close', {
    roomId: roomId.value,
    mediaId: activeShare.value.id
  })

  clearActiveShare()
  setRemoteControlState('', '')
  pushSystemMessage(fromTrackEnded ? '屏幕共享已结束' : '你关闭了当前共享')
}

async function toggleAudio() {
  if (!navigator.mediaDevices?.getUserMedia) {
    alert('当前浏览器不支持麦克风')
    return
  }

  if (isAudioOn.value) {
    removeLocalTrack('audio')
    refreshLocalTracksForPeers()
    return
  }

  await enableLocalTrack('audio')
}

function toggleSpeaker() {
  isSpeakerOn.value = !isSpeakerOn.value
  syncRemoteAudioPlayback()
  nextTick(syncSharedVideoElementSource)
}

async function toggleVideo() {
  if (!navigator.mediaDevices?.getUserMedia) {
    alert('当前浏览器不支持摄像头')
    return
  }

  if (isVideoOn.value) {
    removeLocalTrack('video')
    refreshLocalTracksForPeers()
    return
  }

  await enableLocalTrack('video')
}

function leaveRoom() {
  hasRequestedLeave.value = true

  if (socket.value?.connected) {
    socket.value.emit('leave-room')
  }

  cleanupSession()
  router.push('/')
}

function grantAdminTo(peer) {
  if (!canGrantAdmin.value || !socket.value?.connected) return

  const confirmed = confirm(`确定授予 ${peer.name} 管理员权限吗？`)
  if (!confirmed) return

  socket.value.emit('grant-admin', {
    roomId: roomId.value,
    targetId: peer.id
  })
}

function revokeAdminFrom(peer) {
  if (!canGrantAdmin.value || !socket.value?.connected) return

  const confirmed = confirm(`确定撤销 ${peer.name} 的管理员权限吗？`)
  if (!confirmed) return

  socket.value.emit('revoke-admin', {
    roomId: roomId.value,
    targetId: peer.id
  })
}

watch(localMediaStream, async () => {
  await nextTick()
  syncLocalVideo()
})

watch(gomokuInviteTargets, () => {
  const validIdSet = new Set(gomokuInviteTargets.value.map((peer) => peer.id))
  if (!validIdSet.has(selectedGomokuInviteeId.value)) {
    selectedGomokuInviteeId.value = ''
  }
})

watch(landlordInviteTargets, () => {
  const validIdSet = new Set(landlordInviteTargets.value.map((peer) => peer.id))
  selectedLandlordInviteeIds.value = selectedLandlordInviteeIds.value.filter((peerId) => validIdSet.has(peerId))
})

watch(myLandlordHand, () => {
  const validIdSet = new Set(myLandlordHand.value.map((card) => card.id))
  selectedLandlordCardIds.value = selectedLandlordCardIds.value.filter((cardId) => validIdSet.has(cardId))
})

watch(
  [sharedIncomingStream, activeShare, sharedVideoRef],
  async () => {
    await nextTick()
    if (
      isStreamShare(activeShare.value)
      && activeShare.value.ownerId !== selfId.value
      && !sharedIncomingStream.value
    ) {
      tryBindSharedIncomingStream(activeShare.value.ownerId)
    }
    syncSharedVideoElementSource()
    restartIncomingStreamHealthMonitor()
    if (activeShare.value?.kind !== 'video') {
      syncSharedVideoUiFromState(null)
    }
  },
  { deep: true }
)

watch(
  () => [
    otherParticipants.value.length,
    activeShare.value?.id,
    activeShare.value?.kind,
    activeShare.value?.deliveryMode,
    sharedOutgoingStream.value?.id,
    localMediaStream.value?.id
  ],
  () => {
    refreshOutgoingMediaQuality()
  }
)

onMounted(() => {
  connectSocket()
})

onUnmounted(() => {
  if (sharedVideoUiTicker) {
    clearInterval(sharedVideoUiTicker)
    sharedVideoUiTicker = null
  }
  if (incomingStreamHealthTicker) {
    clearInterval(incomingStreamHealthTicker)
    incomingStreamHealthTicker = null
  }
  cleanupSession()
})
</script>

<style scoped>
.container {
  position: relative;
  min-height: 100vh;
  overflow: hidden;
  color: var(--text-primary);
  display: flex;
  flex-direction: column;
}

.ambient {
  position: absolute;
  border-radius: 999px;
  filter: blur(96px);
  opacity: 0.4;
  pointer-events: none;
}

.ambient-left {
  width: 340px;
  height: 340px;
  top: 72px;
  left: -120px;
  background: rgba(59, 130, 246, 0.16);
}

.ambient-right {
  width: 320px;
  height: 320px;
  right: -120px;
  top: 120px;
  background: rgba(225, 29, 72, 0.12);
}

.ambient-bottom {
  width: 360px;
  height: 360px;
  left: 32%;
  bottom: -200px;
  background: rgba(249, 115, 22, 0.12);
}

.hidden-input {
  display: none;
}

.header {
  position: relative;
  z-index: 1;
  margin: 24px 24px 0;
  padding: 22px 24px;
  border-radius: 28px;
  border: 1px solid rgba(167, 185, 210, 0.12);
  background:
    radial-gradient(circle at top right, rgba(249, 115, 22, 0.1), transparent 28%),
    linear-gradient(180deg, rgba(8, 15, 28, 0.86), rgba(10, 20, 36, 0.72));
  backdrop-filter: blur(24px);
  box-shadow: var(--shadow-soft);
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
}

.header-main {
  min-width: 0;
}

.room-title-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  margin-bottom: 10px;
}

.room-title-block {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.room-title {
  font-family: var(--font-display);
  font-size: clamp(28px, 3vw, 36px);
  font-weight: 700;
  letter-spacing: -0.04em;
  color: #ffffff;
}

.participant-chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 34px;
  background: rgba(59, 130, 246, 0.12);
  color: #dbeafe;
  border: 1px solid rgba(96, 165, 250, 0.16);
  border-radius: 999px;
  padding: 0 12px;
  font-size: 12px;
  font-weight: 600;
}

.profile-chip {
  padding-right: 14px;
}

.self-chip {
  background: rgba(16, 185, 129, 0.12);
  color: #d1fae5;
  border-color: rgba(52, 211, 153, 0.18);
}

.stage-chip {
  background: rgba(225, 29, 72, 0.12);
  color: #fecdd3;
  border-color: rgba(251, 113, 133, 0.18);
}

.admin-chip {
  background: rgba(245, 158, 11, 0.14);
  color: #fde68a;
  border-color: rgba(251, 191, 36, 0.18);
}

.member-chip {
  background: rgba(148, 163, 184, 0.1);
  color: #e2e8f0;
  border-color: rgba(148, 163, 184, 0.16);
}

.room-hint {
  margin: 0;
  color: var(--text-muted);
  font-size: 14px;
  line-height: 1.7;
}

.header-actions {
  flex: 0 0 auto;
}

.leave-btn,
.primary-btn,
.secondary-btn,
.ghost-btn {
  border: none;
  cursor: pointer;
  transition: 0.2s ease;
}

.leave-btn {
  min-height: 46px;
  border-radius: 16px;
  border: 1px solid rgba(248, 113, 113, 0.16);
  background: rgba(127, 29, 29, 0.26);
  color: #fecaca;
  padding: 0 18px;
}

.leave-btn:hover,
.primary-btn:hover,
.secondary-btn:hover,
.ghost-btn:hover,
.tiny-btn:hover,
.control-pill:hover {
  transform: translateY(-1px);
}

.content {
  position: relative;
  z-index: 1;
  flex: 1;
  min-height: 0;
  display: grid;
  align-items: stretch;
  grid-template-columns: minmax(0, 1.82fr) minmax(336px, 0.84fr);
  gap: 18px;
  padding: 20px 22px 24px;
}

.shared-section {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.shared-overview {
  padding: 20px 22px;
  border-radius: 24px;
  border: 1px solid rgba(167, 185, 210, 0.12);
  background: rgba(8, 15, 28, 0.68);
  backdrop-filter: blur(20px);
}

.section-kicker {
  display: inline-flex;
  color: #fb7185;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.section-title-row {
  margin-top: 10px;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}

.section-title {
  margin: 0;
  font-family: var(--font-display);
  font-size: clamp(24px, 2.3vw, 32px);
  line-height: 1.02;
  letter-spacing: -0.04em;
}

.section-state {
  flex: 0 0 auto;
  min-height: 34px;
  padding: 0 12px;
  border-radius: 999px;
  background: rgba(59, 130, 246, 0.14);
  color: #dbeafe;
  display: inline-flex;
  align-items: center;
  font-size: 12px;
  font-weight: 700;
}

.section-caption {
  margin: 12px 0 0;
  max-width: 760px;
  color: var(--text-secondary);
  font-size: 14px;
  line-height: 1.7;
}

.stage-shell {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 14px;
  border-radius: 28px;
  border: 1px solid rgba(167, 185, 210, 0.12);
  background:
    radial-gradient(circle at top left, rgba(59, 130, 246, 0.1), transparent 34%),
    radial-gradient(circle at bottom right, rgba(244, 114, 182, 0.08), transparent 28%),
    linear-gradient(180deg, rgba(8, 15, 28, 0.8), rgba(10, 20, 36, 0.68));
  box-shadow: var(--shadow-soft);
  backdrop-filter: blur(24px);
}

.shared-stage {
  position: relative;
  height: clamp(360px, 60vh, 560px);
  border-radius: 30px;
  background: linear-gradient(160deg, rgba(6, 11, 20, 0.98), rgba(15, 23, 42, 0.96));
  border: 1px solid rgba(167, 185, 210, 0.12);
  overflow: hidden;
  display: flex;
  justify-content: center;
  align-items: center;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
}

.shared-stage.empty {
  border-style: dashed;
  background:
    radial-gradient(circle at center, rgba(59, 130, 246, 0.08), transparent 32%),
    linear-gradient(160deg, rgba(6, 11, 20, 0.94), rgba(15, 23, 42, 0.92));
}

.shared-stage.controllable {
  cursor: crosshair;
  box-shadow: inset 0 0 0 1px rgba(96, 165, 250, 0.28), 0 0 0 1px rgba(96, 165, 250, 0.08);
}

.shared-stage.game-mode {
  height: clamp(580px, 83vh, 920px);
  align-items: stretch;
  background:
    radial-gradient(circle at top, rgba(59, 130, 246, 0.08), transparent 34%),
    linear-gradient(160deg, rgba(6, 11, 20, 0.98), rgba(15, 23, 42, 0.96));
}

.game-stage {
  width: 100%;
  height: 100%;
  padding: 10px;
  overflow: auto;
  display: flex;
  justify-content: center;
  align-items: stretch;
}

.game-panel.in-match {
  padding: 14px 14px 12px;
  gap: 10px;
}

.game-panel.in-match .game-panel-hero {
  padding: 14px 16px;
  gap: 10px;
  border-radius: 20px;
  background:
    linear-gradient(135deg, rgba(59, 130, 246, 0.12), rgba(168, 85, 247, 0.08)),
    rgba(255, 255, 255, 0.04);
}

.game-panel.in-match .game-panel-hero-copy strong {
  margin-top: 6px;
  font-size: clamp(20px, 2.2vw, 26px);
}

.game-panel.in-match .game-panel-hero-orbs {
  display: none;
}

.game-panel.in-match .game-panel-header {
  display: none;
}

.game-panel.in-match .game-panel-status {
  padding: 5px 10px;
  font-size: 11px;
}

.share-toolbar {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  border-radius: 22px;
  border: 1px solid rgba(167, 185, 210, 0.1);
  background: rgba(255, 255, 255, 0.04);
}

.share-toolbar-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.share-toolbar-hint {
  color: var(--text-muted);
  font-size: 13px;
}

.shared-image,
.shared-video {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.webpage-share-container {
  width: 100%;
  height: 100%;
  background: #fff;
  border-radius: 12px;
  overflow: hidden;
  position: relative;
}

.webpage-toolbar {
  position: absolute;
  top: 16px;
  right: 16px;
  z-index: 4;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  border-radius: 999px;
  background: rgba(8, 15, 28, 0.72);
  border: 1px solid rgba(167, 185, 210, 0.2);
  backdrop-filter: blur(12px);
  box-shadow: 0 12px 28px rgba(2, 6, 23, 0.22);
}

.webpage-nav-btn {
  width: 38px;
  height: 38px;
  border: none;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.1);
  color: #f8fafc;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: transform 0.18s ease, background 0.18s ease, opacity 0.18s ease;
}

.webpage-nav-btn svg {
  width: 18px;
  height: 18px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.webpage-nav-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  background: rgba(96, 165, 250, 0.22);
}

.webpage-nav-btn.refresh:hover:not(:disabled) {
  background: rgba(34, 197, 94, 0.22);
}

.webpage-nav-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.webpage-iframe {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  border: none;
  border-radius: 12px;
}

.webpage-iframe.active {
  z-index: 2;
}

.webpage-iframe.inactive {
  z-index: 1;
  opacity: 0;
  pointer-events: none;
  visibility: hidden;
}

.webpage-iframe.hidden {
  visibility: hidden;
}

.webpage-loading {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  color: #64748b;
}

.shared-image {
  cursor: zoom-in;
  transition: transform 0.25s ease;
}

.shared-image.readonly {
  cursor: default;
}

.shared-image.zoomed {
  transform: scale(1.8);
  cursor: zoom-out;
}

.share-badge {
  position: absolute;
  top: 18px;
  left: 18px;
  max-width: calc(100% - 36px);
  background: rgba(8, 15, 28, 0.82);
  color: #f8fbff;
  padding: 9px 13px;
  border-radius: 999px;
  font-size: 13px;
  border: 1px solid rgba(167, 185, 210, 0.12);
  backdrop-filter: blur(12px);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  box-sizing: border-box;
}

.remote-pointer {
  position: absolute;
  z-index: 4;
  transform: translate(-50%, -50%);
  display: inline-flex;
  align-items: center;
  gap: 8px;
  pointer-events: none;
}

.remote-pointer-dot {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #38bdf8;
  border: 2px solid white;
  box-shadow: 0 0 0 6px rgba(56, 189, 248, 0.18);
}

.remote-pointer-label {
  background: rgba(15, 23, 42, 0.88);
  color: #e0f2fe;
  padding: 6px 10px;
  border-radius: 999px;
  font-size: 12px;
  white-space: nowrap;
}

.remote-command-overlay {
  position: absolute;
  z-index: 5;
  transform: translate(-50%, -50%);
  display: inline-flex;
  align-items: center;
  gap: 10px;
  pointer-events: none;
}

.remote-command-pulse {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: rgba(248, 113, 113, 0.92);
  border: 2px solid rgba(255, 255, 255, 0.96);
  box-shadow: 0 0 0 10px rgba(248, 113, 113, 0.18);
  animation: remote-pulse 0.9s ease-out infinite;
}

.remote-command-label {
  background: rgba(15, 23, 42, 0.92);
  color: #fee2e2;
  padding: 7px 12px;
  border-radius: 999px;
  font-size: 12px;
  white-space: nowrap;
}

.share-footer {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 22px 22px 20px;
  background: linear-gradient(180deg, rgba(8, 15, 28, 0), rgba(8, 15, 28, 0.92));
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 16px;
}

.share-meta {
  min-width: 0;
  flex: 1 1 auto;
}

.video-control-panel {
  display: grid;
  grid-template-columns: clamp(40px, 3vw, 52px) clamp(40px, 3vw, 52px) minmax(0, 1fr) auto clamp(40px, 3vw, 52px);
  align-items: center;
  gap: clamp(8px, 1vw, 14px);
  width: 100%;
}

.video-controls-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.video-progress-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 10px;
}

.control-pill {
  border: 1px solid rgba(96, 165, 250, 0.18);
  border-radius: 999px;
  background: rgba(59, 130, 246, 0.16);
  color: #eff6ff;
  min-height: clamp(38px, 4vw, 48px);
  padding: 0 clamp(10px, 1.4vw, 16px);
}

.playback-btn {
  min-width: clamp(40px, 3vw, 52px);
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.volume-btn {
  width: clamp(40px, 3vw, 52px);
  height: clamp(38px, 4vw, 48px);
  min-width: clamp(40px, 3vw, 52px);
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.volume-btn.muted {
  background: rgba(239, 68, 68, 0.16);
  border-color: rgba(239, 68, 68, 0.18);
  color: #fecaca;
}

.control-icon {
  width: clamp(16px, 1.5vw, 20px);
  height: clamp(16px, 1.5vw, 20px);
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.fullscreen-btn {
  width: clamp(40px, 3vw, 52px);
  height: clamp(38px, 4vw, 48px);
  min-width: clamp(40px, 3vw, 52px);
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.progress-slider {
  width: 100%;
  min-width: 0;
  accent-color: #60a5fa;
}

:fullscreen .share-meta {
  width: 100%;
}

:fullscreen .video-control-panel {
  width: 100%;
  grid-template-columns: clamp(48px, 4.2vw, 60px) clamp(48px, 4.2vw, 60px) minmax(0, 1fr) auto clamp(48px, 4.2vw, 60px);
}

:fullscreen .progress-slider {
  width: 100%;
  min-width: 0;
}

.time-label {
  font-size: clamp(12px, 1.2vw, 14px);
  color: #e2e8f0;
  min-width: clamp(88px, 10vw, 126px);
  text-align: right;
}

.share-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: clamp(10px, 1vw, 14px);
}

.stage-fullscreen-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.share-close-drawer {
  position: absolute;
  bottom: 18px;
  right: 0;
  z-index: 5;
  display: inline-flex;
  align-items: stretch;
  gap: 0;
  transform: translateX(calc(100% - 32px));
  transition: transform 0.22s ease;
  filter: drop-shadow(0 14px 30px rgba(2, 6, 23, 0.32));
}

.share-close-drawer:hover,
.share-close-drawer:focus-within {
  transform: translateX(0);
}

.share-close-trigger,
.share-close-btn {
  border: none;
  color: #f8fafc;
  cursor: pointer;
}

.share-close-trigger {
  width: 32px;
  min-height: 44px;
  border-radius: 16px 0 0 16px;
  background: rgba(15, 23, 42, 0.92);
  border: 1px solid rgba(167, 185, 210, 0.14);
  border-right: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  font-weight: 700;
  line-height: 1;
}

.share-close-btn {
  min-height: 44px;
  padding: 0 14px;
  white-space: nowrap;
  border-radius: 0 16px 16px 0;
  background: linear-gradient(135deg, rgba(220, 38, 38, 0.92), rgba(239, 68, 68, 0.88));
  border: 1px solid rgba(248, 113, 113, 0.24);
  font-size: 13px;
  font-weight: 700;
}

.share-close-trigger:hover,
.share-close-btn:hover {
  filter: brightness(1.06);
}

.share-close-trigger:focus-visible,
.share-close-btn:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px rgba(248, 113, 113, 0.24);
}

.ghost-btn {
  min-height: clamp(38px, 4vw, 48px);
  border: 1px solid rgba(167, 185, 210, 0.14);
  background: rgba(255, 255, 255, 0.08);
  color: #f8fafc;
  border-radius: 14px;
  padding: 0 clamp(12px, 1.6vw, 18px);
}

.ghost-btn.danger {
  border-color: rgba(248, 113, 113, 0.16);
  background: rgba(239, 68, 68, 0.14);
  color: #fecaca;
}

.empty-share,
.share-loading {
  text-align: center;
  color: var(--text-secondary);
  padding: 24px;
}

.empty-share h3 {
  font-family: var(--font-display);
  font-size: 30px;
  margin: 0 0 12px;
  color: #ffffff;
}

.empty-share p {
  margin: 0 0 20px;
  color: var(--text-muted);
}

.primary-btn,
.secondary-btn {
  min-height: 42px;
  border-radius: 14px;
  padding: 0 16px;
  color: white;
}

.primary-btn {
  background: linear-gradient(135deg, #2563eb, #7c3aed);
  box-shadow: 0 16px 30px rgba(37, 99, 235, 0.16);
}

.primary-btn.compact {
  padding-inline: 14px;
}

.secondary-btn {
  border: 1px solid rgba(167, 185, 210, 0.14);
  background: rgba(255, 255, 255, 0.08);
  color: #f8fbff;
}

.secondary-btn.active {
  background: rgba(59, 130, 246, 0.18);
  box-shadow: inset 0 0 0 1px rgba(96, 165, 250, 0.26), 0 12px 24px rgba(37, 99, 235, 0.12);
}

.primary-btn:disabled,
.secondary-btn:disabled,
.ghost-btn:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.loader {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  border: 4px solid rgba(148, 163, 184, 0.2);
  border-top-color: #60a5fa;
  margin: 0 auto 16px;
  animation: spin 1s linear infinite;
}

.game-panel {
  position: relative;
  overflow: hidden;
  border-radius: 28px;
  border: 1px solid rgba(167, 185, 210, 0.12);
  background:
    radial-gradient(circle at top left, rgba(34, 197, 94, 0.08), transparent 28%),
    linear-gradient(180deg, rgba(8, 15, 28, 0.92), rgba(10, 20, 36, 0.82));
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.game-panel::before {
  content: '';
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at top right, rgba(59, 130, 246, 0.16), transparent 28%),
    radial-gradient(circle at 18% 90%, rgba(225, 29, 72, 0.12), transparent 24%);
  pointer-events: none;
}

.game-panel.stage-embedded {
  width: 100%;
  min-height: 100%;
}

.game-panel.stage-embedded.in-match {
  border-radius: 26px;
  border-color: rgba(96, 165, 250, 0.16);
  background:
    radial-gradient(circle at top left, rgba(59, 130, 246, 0.12), transparent 26%),
    radial-gradient(circle at bottom left, rgba(225, 29, 72, 0.1), transparent 24%),
    linear-gradient(180deg, rgba(8, 15, 28, 0.94), rgba(10, 20, 36, 0.88));
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04), 0 24px 56px rgba(2, 6, 23, 0.26);
}

.game-panel-hero {
  position: relative;
  z-index: 1;
  display: flex;
  justify-content: space-between;
  gap: 18px;
  padding: 18px 20px;
  border-radius: 24px;
  border: 1px solid rgba(167, 185, 210, 0.12);
  background:
    linear-gradient(135deg, rgba(37, 99, 235, 0.16), rgba(225, 29, 72, 0.08)),
    rgba(255, 255, 255, 0.04);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
}

.game-panel-hero-copy {
  max-width: 640px;
}

.game-panel-kicker {
  display: inline-flex;
  color: #93c5fd;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.game-panel-hero-copy strong {
  display: block;
  margin-top: 10px;
  color: #ffffff;
  font-family: var(--font-display);
  font-size: clamp(24px, 2.6vw, 34px);
  line-height: 1;
  letter-spacing: -0.04em;
}

.game-panel-hero-copy p {
  margin: 10px 0 0;
  color: var(--text-secondary);
  font-size: 14px;
  line-height: 1.7;
}

.game-panel-hero-orbs {
  display: flex;
  align-items: center;
  gap: 10px;
  align-self: flex-start;
}

.game-orb {
  display: inline-block;
  border-radius: 50%;
  box-shadow: 0 0 0 8px rgba(255, 255, 255, 0.03);
}

.game-orb.blue {
  width: 14px;
  height: 14px;
  background: #60a5fa;
}

.game-orb.rose {
  width: 24px;
  height: 24px;
  background: radial-gradient(circle at 32% 32%, #fda4af, #e11d48 72%);
}

.game-orb.gold {
  width: 12px;
  height: 12px;
  background: #f59e0b;
}

.game-panel-header {
  position: relative;
  z-index: 1;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
}

.game-panel-header .panel-title {
  margin-bottom: 0;
}

.game-panel-subtitle {
  margin: 6px 0 0;
  color: var(--text-muted);
  font-size: 13px;
}

.game-panel-status {
  flex: 0 0 auto;
  border-radius: 999px;
  padding: 6px 10px;
  background: rgba(59, 130, 246, 0.14);
  color: #dbeafe;
  font-size: 12px;
  font-weight: 700;
}

.game-panel-tools {
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
}

.game-launcher-grid {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 16px;
}

.game-app-button {
  position: relative;
  overflow: hidden;
  min-height: 224px;
  border: 1px solid rgba(167, 185, 210, 0.12);
  border-radius: 26px;
  padding: 20px 18px 18px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: flex-end;
  gap: 8px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.03)),
    rgba(255, 255, 255, 0.03);
  color: #ffffff;
  text-align: left;
  transition: transform 0.22s ease, border-color 0.22s ease, box-shadow 0.22s ease, background 0.22s ease;
}

.game-app-button:hover {
  transform: translateY(-3px);
  border-color: rgba(96, 165, 250, 0.24);
  box-shadow: 0 26px 40px rgba(8, 15, 28, 0.24);
}

.game-app-button:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.22);
}

.game-app-button.gomoku {
  background:
    radial-gradient(circle at 22% 18%, rgba(245, 158, 11, 0.18), transparent 24%),
    linear-gradient(180deg, rgba(12, 21, 36, 0.9), rgba(15, 23, 42, 0.72));
}

.game-app-button.landlord {
  background:
    radial-gradient(circle at 78% 20%, rgba(249, 115, 22, 0.18), transparent 22%),
    linear-gradient(180deg, rgba(17, 24, 39, 0.92), rgba(69, 26, 3, 0.58));
}

.game-app-icon-frame {
  position: absolute;
  top: 18px;
  left: 18px;
  width: 92px;
  height: 92px;
  display: grid;
  place-items: center;
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(167, 185, 210, 0.12);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06);
}

.game-app-icon-svg {
  width: 56px;
  height: 56px;
  display: block;
}

.game-app-button.gomoku .game-app-icon-frame {
  color: #f8fafc;
  background: linear-gradient(180deg, rgba(180, 132, 73, 0.92), rgba(140, 97, 56, 0.92));
}

.game-app-button.landlord .game-app-icon-frame {
  color: #fef3c7;
  background: linear-gradient(180deg, rgba(124, 45, 18, 0.92), rgba(69, 26, 3, 0.94));
}

.game-app-name {
  margin-top: auto;
  font-family: var(--font-display);
  font-size: 24px;
  font-weight: 700;
  letter-spacing: -0.04em;
}

.game-app-subtitle {
  color: var(--text-secondary);
  font-size: 14px;
  line-height: 1.6;
}

.game-app-meta {
  min-height: 28px;
  padding: 0 10px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  background: rgba(255, 255, 255, 0.08);
  color: #dbeafe;
  font-size: 12px;
  font-weight: 700;
}

.game-home-panel {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.game-home-header {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.game-home-back {
  min-height: 40px;
  padding: 0 14px;
  align-self: flex-start;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  border: 1px solid rgba(167, 185, 210, 0.12);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.06);
  color: #e2e8f0;
}

.game-home-back svg {
  width: 18px;
  height: 18px;
  stroke: currentColor;
  fill: none;
  stroke-width: 1.9;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.game-home-hero {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 18px;
  border-radius: 24px;
  border: 1px solid rgba(167, 185, 210, 0.12);
  background: rgba(255, 255, 255, 0.05);
}

.game-home-icon {
  flex: 0 0 auto;
  width: 84px;
  height: 84px;
  display: grid;
  place-items: center;
  border-radius: 22px;
  border: 1px solid rgba(167, 185, 210, 0.12);
}

.game-home-icon.gomoku {
  color: #f8fafc;
  background: linear-gradient(180deg, rgba(180, 132, 73, 0.94), rgba(140, 97, 56, 0.94));
}

.game-home-icon.landlord {
  color: #fef3c7;
  background: linear-gradient(180deg, rgba(124, 45, 18, 0.94), rgba(69, 26, 3, 0.96));
}

.game-home-copy {
  min-width: 0;
}

.game-home-kicker {
  display: inline-flex;
  color: #93c5fd;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.game-home-title {
  margin: 10px 0 0;
  color: #ffffff;
  font-family: var(--font-display);
  font-size: clamp(24px, 2.4vw, 32px);
  line-height: 1.02;
  letter-spacing: -0.04em;
}

.game-home-subtitle {
  margin: 10px 0 0;
  color: var(--text-secondary);
  font-size: 14px;
  line-height: 1.7;
}

.game-home-summary {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  border-radius: 18px;
  background: rgba(8, 15, 28, 0.54);
  border: 1px solid rgba(167, 185, 210, 0.1);
}

.game-home-summary span {
  color: var(--text-secondary);
  font-size: 13px;
}

.game-home-summary strong {
  color: #ffffff;
  font-size: 14px;
}

.game-seat-grid {
  display: grid;
  gap: 12px;
}

.game-seat-grid.two-seat {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.game-seat-grid.three-seat {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.game-seat-card {
  min-height: 168px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  align-items: stretch;
  gap: 16px;
  padding: 18px;
  border-radius: 22px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.06), rgba(255, 255, 255, 0.03)),
    rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(167, 185, 210, 0.1);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03);
}

.game-seat-card.self-seat {
  background:
    radial-gradient(circle at top left, rgba(59, 130, 246, 0.14), transparent 28%),
    linear-gradient(180deg, rgba(9, 16, 31, 0.92), rgba(15, 23, 42, 0.72));
}

.game-seat-card.selected-seat {
  background:
    radial-gradient(circle at top right, rgba(34, 197, 94, 0.12), transparent 24%),
    rgba(255, 255, 255, 0.05);
}

.game-seat-card.invite-seat {
  align-items: center;
  justify-content: center;
  text-align: center;
  background:
    radial-gradient(circle at center, rgba(59, 130, 246, 0.08), transparent 32%),
    rgba(8, 15, 28, 0.56);
  transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
}

.game-seat-card.invite-seat:hover:not(:disabled) {
  transform: translateY(-2px);
  border-color: rgba(96, 165, 250, 0.22);
  box-shadow: 0 20px 30px rgba(8, 15, 28, 0.18);
}

.game-seat-card.invite-seat:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.game-seat-main {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 14px;
}

.game-seat-copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.game-seat-copy strong {
  color: #ffffff;
  font-size: 16px;
}

.game-seat-copy span {
  color: var(--text-muted);
  font-size: 12px;
}

.game-seat-plus {
  width: 54px;
  height: 54px;
  display: grid;
  place-items: center;
  border-radius: 18px;
  background: rgba(59, 130, 246, 0.14);
  border: 1px solid rgba(96, 165, 250, 0.16);
  color: #dbeafe;
}

.game-seat-plus svg,
.seat-clear-btn svg,
.seat-picker-close svg {
  width: 20px;
  height: 20px;
  stroke: currentColor;
  fill: none;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.game-seat-card.invite-seat strong {
  color: #ffffff;
  font-size: 16px;
}

.game-seat-card.invite-seat span:last-child {
  color: var(--text-muted);
  font-size: 13px;
  line-height: 1.6;
}

.seat-clear-btn {
  width: 38px;
  height: 38px;
  align-self: flex-end;
  display: grid;
  place-items: center;
  border-radius: 12px;
  border: 1px solid rgba(167, 185, 210, 0.12);
  background: rgba(255, 255, 255, 0.06);
  color: #e2e8f0;
}

.game-seat-picker {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 18px;
  border-radius: 22px;
  background: rgba(8, 15, 28, 0.58);
  border: 1px solid rgba(167, 185, 210, 0.12);
}

.game-seat-picker-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 14px;
}

.game-seat-picker-kicker {
  display: inline-flex;
  color: #93c5fd;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.game-seat-picker-header strong {
  display: block;
  margin-top: 8px;
  color: #ffffff;
  font-size: 17px;
  line-height: 1.5;
}

.seat-picker-close {
  width: 38px;
  height: 38px;
  display: grid;
  place-items: center;
  border-radius: 12px;
  border: 1px solid rgba(167, 185, 210, 0.12);
  background: rgba(255, 255, 255, 0.06);
  color: #e2e8f0;
}

.seat-picker-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 12px;
}

.seat-picker-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px;
  border-radius: 18px;
  border: 1px solid rgba(167, 185, 210, 0.1);
  background: rgba(255, 255, 255, 0.05);
  color: inherit;
  text-align: left;
  transition: transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease;
}

.seat-picker-card:hover {
  transform: translateY(-1px);
  border-color: rgba(96, 165, 250, 0.22);
  box-shadow: 0 18px 28px rgba(8, 15, 28, 0.16);
}

.seat-picker-copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.seat-picker-copy strong {
  color: #ffffff;
  font-size: 15px;
}

.seat-picker-copy span {
  color: var(--text-muted);
  font-size: 12px;
}

.game-home-actions {
  display: flex;
  justify-content: flex-end;
}

.game-catalog {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.game-card {
  position: relative;
  overflow: hidden;
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
  border-radius: 22px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.06), rgba(255, 255, 255, 0.03)),
    rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(167, 185, 210, 0.12);
  padding: 18px;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03);
}

.game-card::before {
  content: '';
  position: absolute;
  inset: 0 auto 0 0;
  width: 4px;
  background: linear-gradient(180deg, #60a5fa, #fb7185);
  opacity: 0.9;
}

.game-card-main {
  min-width: 0;
}

.game-card-topline {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.game-card-kicker {
  color: #93c5fd;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.game-card-chip {
  min-height: 28px;
  padding: 0 10px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  background: rgba(255, 255, 255, 0.08);
  color: #fef3c7;
  font-size: 11px;
  font-weight: 700;
}

.game-card-title {
  font-family: var(--font-display);
  font-size: 24px;
  font-weight: 700;
  color: #f8fafc;
  letter-spacing: -0.04em;
}

.game-card-desc {
  margin-top: 8px;
  color: var(--text-secondary);
  font-size: 14px;
  line-height: 1.6;
}

.game-card-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 14px;
}

.game-card-tag {
  min-height: 30px;
  padding: 0 10px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  background: rgba(8, 15, 28, 0.56);
  border: 1px solid rgba(167, 185, 210, 0.1);
  color: #dbeafe;
  font-size: 12px;
  font-weight: 600;
}

.game-target-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.game-target-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  border-radius: 16px;
  background: rgba(8, 15, 28, 0.58);
  padding: 12px;
  border: 1px solid rgba(167, 185, 210, 0.08);
}

.game-target-profile {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 10px;
}

.game-target-meta {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.game-target-meta span {
  color: #f8fafc;
}

.game-target-meta em {
  color: #94a3b8;
  font-size: 12px;
  font-style: normal;
}

.game-empty {
  border-radius: 16px;
  padding: 14px;
  background: rgba(8, 15, 28, 0.52);
  color: var(--text-muted);
  font-size: 13px;
}

.game-selection-summary {
  border-radius: 16px;
  padding: 12px 14px;
  background: rgba(8, 15, 28, 0.52);
  color: var(--text-secondary);
  font-size: 13px;
}

.game-invite-banner {
  position: relative;
  z-index: 1;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 14px;
  padding: 16px 18px;
  border-radius: 24px;
  background:
    linear-gradient(135deg, rgba(37, 99, 235, 0.14), rgba(225, 29, 72, 0.1)),
    rgba(8, 15, 28, 0.72);
  border: 1px solid rgba(96, 165, 250, 0.18);
}

.game-invite-copy {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.game-invite-kicker {
  color: #93c5fd;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.game-invite-copy strong {
  color: #f8fafc;
  font-size: 18px;
}

.game-invite-copy span {
  color: var(--text-secondary);
  font-size: 13px;
}

.game-invite-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.gomoku-section {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.game-panel.in-match .gomoku-section,
.game-panel.in-match .landlord-section {
  gap: 12px;
}

@media (min-width: 1081px) {
  .game-panel.in-match .gomoku-section {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(154px, 172px);
    grid-template-areas:
      "board banner"
      "board players"
      "board actions";
    align-items: start;
    gap: 10px;
  }

  .game-panel.in-match .gomoku-mode-banner {
    grid-area: banner;
    flex-direction: column;
    align-items: stretch;
  }

  .game-panel.in-match .gomoku-header {
    grid-area: players;
    grid-template-columns: 1fr;
    align-items: stretch;
  }

  .game-panel.in-match .gomoku-board-shell {
    grid-area: board;
    margin: 0;
  }

  .game-panel.in-match .gomoku-actions {
    grid-area: actions;
    flex-direction: column;
    align-items: stretch;
    justify-content: flex-start;
  }

  .game-panel.in-match .gomoku-actions .ghost-btn {
    width: 100%;
  }
}

.game-mode-banner {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  padding: 18px 20px;
  border-radius: 24px;
  border: 1px solid rgba(167, 185, 210, 0.12);
  background: rgba(255, 255, 255, 0.05);
}

.game-panel.in-match .game-mode-banner {
  gap: 12px;
  padding: 12px 14px;
  border-radius: 20px;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
}

.game-mode-copy {
  max-width: 680px;
}

.game-mode-kicker {
  display: inline-flex;
  color: #93c5fd;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.game-mode-copy strong {
  display: block;
  margin-top: 10px;
  color: #ffffff;
  font-size: 18px;
  line-height: 1.45;
}

.game-panel.in-match .game-mode-copy strong {
  margin-top: 6px;
  font-size: 16px;
  line-height: 1.35;
}

.game-mode-badge {
  flex: 0 0 auto;
  min-height: 34px;
  padding: 0 12px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  background: rgba(59, 130, 246, 0.16);
  color: #dbeafe;
  font-size: 12px;
  font-weight: 700;
}

.game-panel.in-match .game-mode-badge {
  min-height: 30px;
  padding: 0 10px;
  font-size: 11px;
}

.gomoku-mode-banner {
  background:
    radial-gradient(circle at 0% 50%, rgba(245, 158, 11, 0.18), transparent 26%),
    rgba(255, 255, 255, 0.05);
}

.gomoku-header {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  gap: 14px;
  align-items: center;
}

.game-panel.in-match .gomoku-header,
.game-panel.in-match .landlord-header {
  gap: 10px;
}

.gomoku-player-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(167, 185, 210, 0.12);
}

.game-panel.in-match .gomoku-player-card {
  gap: 8px;
  padding: 10px 12px;
  border-radius: 16px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.04)),
    rgba(8, 15, 28, 0.56);
}

.gomoku-player-card.current {
  border-color: rgba(96, 165, 250, 0.28);
  box-shadow: inset 0 0 0 1px rgba(96, 165, 250, 0.16), 0 16px 28px rgba(37, 99, 235, 0.1);
}

.gomoku-player-card strong {
  display: block;
  color: #f8fafc;
}

.gomoku-player-copy {
  min-width: 0;
}

.gomoku-player-card em {
  color: var(--text-muted);
  font-size: 12px;
  font-style: normal;
}

.game-panel.in-match .gomoku-player-card strong {
  font-size: 14px;
}

.game-panel.in-match .gomoku-player-card em {
  font-size: 11px;
}

.gomoku-status {
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.game-panel.in-match .gomoku-status {
  gap: 4px;
  padding: 10px 12px;
  border-radius: 16px;
  background:
    radial-gradient(circle at top left, rgba(59, 130, 246, 0.12), transparent 30%),
    rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(167, 185, 210, 0.1);
}

.gomoku-status strong {
  color: #f8fafc;
}

.gomoku-status span {
  color: var(--text-muted);
  font-size: 13px;
}

.game-panel.in-match .gomoku-status strong {
  font-size: 15px;
}

.game-panel.in-match .gomoku-status span {
  font-size: 12px;
}

.gomoku-board-wrap {
  display: flex;
  justify-content: center;
  align-items: center;
  flex: 1;
  min-height: 0;
}

.game-panel.in-match .gomoku-board-wrap {
  align-items: flex-start;
}

.gomoku-board-shell {
  position: relative;
  overflow: hidden;
  padding: 18px;
  border-radius: 28px;
  background: linear-gradient(180deg, rgba(8, 15, 28, 0.62), rgba(15, 23, 42, 0.4));
  border: 1px solid rgba(167, 185, 210, 0.12);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04), 0 20px 48px rgba(2, 6, 23, 0.22);
}

.gomoku-board-shell::before {
  content: '';
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at top left, rgba(250, 204, 21, 0.08), transparent 30%),
    radial-gradient(circle at bottom right, rgba(59, 130, 246, 0.08), transparent 28%);
  pointer-events: none;
}

.game-panel.in-match .gomoku-board-shell {
  padding: 12px;
  border-radius: 24px;
}

.game-panel.in-match .gomoku-board {
  width: min(100%, 560px, calc(100svh - 250px));
  padding: 20px;
  border-radius: 28px;
}

.gomoku-board {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: repeat(15, minmax(0, 1fr));
  width: min(100%, 760px);
  aspect-ratio: 1;
  gap: 0;
  padding: 22px;
  border-radius: 26px;
  background:
    linear-gradient(180deg, rgba(196, 150, 92, 0.96), rgba(147, 101, 58, 0.94));
  box-shadow: inset 0 0 0 1px rgba(15, 23, 42, 0.18), 0 28px 48px rgba(8, 15, 28, 0.28);
}

.gomoku-cell {
  border: none;
  padding: 0;
  background: transparent;
  position: relative;
  display: grid;
  place-items: center;
  cursor: pointer;
  aspect-ratio: 1;
  min-width: 0;
  min-height: 0;
  overflow: visible;
  transition: background 0.15s ease;
}

.gomoku-cell::before,
.gomoku-cell::after {
  content: '';
  position: absolute;
  background: rgba(56, 35, 10, 0.45);
}

.gomoku-cell::before {
  left: 0;
  right: 0;
  top: 50%;
  height: 1px;
  transform: translateY(-50%);
}

.gomoku-cell.edge-left::before {
  left: 50%;
}

.gomoku-cell.edge-right::before {
  right: 50%;
}

.gomoku-cell::after {
  top: 0;
  bottom: 0;
  left: 50%;
  width: 1px;
  transform: translateX(-50%);
}

.gomoku-cell.edge-top::after {
  top: 50%;
}

.gomoku-cell.edge-bottom::after {
  bottom: 50%;
}

.gomoku-cell.playable:hover {
  background: radial-gradient(circle at center, rgba(255, 255, 255, 0.2) 0, rgba(255, 255, 255, 0.2) 16%, transparent 17%);
}

.gomoku-cell:disabled {
  cursor: default;
  opacity: 1;
}

.gomoku-cell.occupied {
  cursor: default;
}

.gomoku-cell.winning {
  background: radial-gradient(circle at center, rgba(34, 197, 94, 0.2) 0, rgba(34, 197, 94, 0.2) 22%, transparent 23%);
}

.gomoku-player-card > .stone {
  flex: 0 0 auto;
  width: 24px;
  aspect-ratio: 1;
  border-radius: 50%;
  display: inline-block;
}

.gomoku-cell > .stone {
  position: relative;
  z-index: 1;
  width: min(74%, 34px);
  aspect-ratio: 1;
  border-radius: 50%;
  display: block;
}

.stone-black {
  background: radial-gradient(circle at 30% 30%, #475569, #020617 68%);
  box-shadow: 0 3px 10px rgba(2, 6, 23, 0.28);
}

.stone-white {
  background: radial-gradient(circle at 30% 30%, #ffffff, #cbd5e1 70%);
  box-shadow: 0 3px 10px rgba(15, 23, 42, 0.18);
}

.gomoku-cell.winning .stone {
  box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.26), 0 0 18px rgba(34, 197, 94, 0.16);
}

.gomoku-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.landlord-section {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.landlord-mode-banner {
  background:
    radial-gradient(circle at 100% 0%, rgba(249, 115, 22, 0.18), transparent 24%),
    rgba(255, 255, 255, 0.05);
}

.landlord-header {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
}

.landlord-player-card {
  padding: 14px;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(167, 185, 210, 0.12);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.game-panel.in-match .landlord-player-card {
  padding: 12px;
  gap: 6px;
  border-radius: 18px;
}

.landlord-player-card.current {
  border-color: rgba(96, 165, 250, 0.28);
  box-shadow: inset 0 0 0 1px rgba(96, 165, 250, 0.16), 0 16px 28px rgba(37, 99, 235, 0.1);
}

.landlord-player-card.landlord {
  background: linear-gradient(180deg, rgba(120, 53, 15, 0.34), rgba(15, 23, 42, 0.74));
  border-color: rgba(251, 191, 36, 0.2);
}

.landlord-player-card.self {
  box-shadow: inset 0 0 0 1px rgba(52, 211, 153, 0.14);
}

.landlord-player-top {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
}

.landlord-player-top strong {
  color: #f8fafc;
}

.landlord-player-identity {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 10px;
}

.landlord-player-top span {
  border-radius: 999px;
  padding: 4px 8px;
  background: rgba(8, 15, 28, 0.62);
  color: #dbeafe;
  font-size: 12px;
}

.game-panel.in-match .landlord-player-top span {
  padding: 3px 7px;
  font-size: 11px;
}

.landlord-player-card em {
  color: var(--text-muted);
  font-size: 12px;
  font-style: normal;
}

.game-panel.in-match .landlord-player-card em {
  font-size: 11px;
}

.landlord-status-card {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 16px;
  padding: 16px;
  border-radius: 20px;
  background: rgba(8, 15, 28, 0.62);
  border: 1px solid rgba(167, 185, 210, 0.12);
}

.game-panel.in-match .landlord-status-card {
  gap: 12px;
  padding: 14px;
  border-radius: 18px;
}

.landlord-status-main {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.game-panel.in-match .landlord-status-main {
  gap: 4px;
}

.landlord-status-main strong {
  color: #f8fafc;
}

.landlord-status-main span {
  color: var(--text-muted);
  font-size: 13px;
}

.game-panel.in-match .landlord-status-main strong {
  font-size: 15px;
}

.game-panel.in-match .landlord-status-main span {
  font-size: 12px;
}

.landlord-bottom-cards {
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: flex-end;
}

.game-panel.in-match .landlord-bottom-cards {
  gap: 6px;
}

.landlord-bottom-cards label {
  color: var(--text-muted);
  font-size: 12px;
}

.landlord-table-grid {
  display: grid;
  grid-template-columns: minmax(240px, 0.78fr) minmax(0, 1fr);
  gap: 16px;
}

.game-panel.in-match .landlord-table-grid {
  gap: 12px;
}

.landlord-bid-panel,
.landlord-table-panel,
.landlord-hand-panel {
  border-radius: 20px;
  padding: 16px;
  background: rgba(8, 15, 28, 0.62);
  border: 1px solid rgba(167, 185, 210, 0.12);
}

.game-panel.in-match .landlord-bid-panel,
.game-panel.in-match .landlord-table-panel,
.game-panel.in-match .landlord-hand-panel {
  padding: 14px;
  border-radius: 18px;
}

.landlord-panel-title {
  color: #f8fafc;
  font-size: 14px;
  font-weight: 700;
  margin-bottom: 12px;
}

.game-panel.in-match .landlord-panel-title {
  margin-bottom: 10px;
  font-size: 13px;
}

.landlord-bid-copy {
  color: var(--text-secondary);
  font-size: 13px;
}

.game-panel.in-match .landlord-bid-copy {
  font-size: 12px;
}

.landlord-bid-history {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 12px;
}

.game-panel.in-match .landlord-bid-history {
  gap: 6px;
  margin-top: 10px;
}

.landlord-bid-history-item {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.05);
  font-size: 13px;
}

.game-panel.in-match .landlord-bid-history-item {
  padding: 8px 10px;
  font-size: 12px;
}

.landlord-bid-history-item span {
  color: #f8fafc;
}

.landlord-bid-history-item em {
  color: var(--text-muted);
  font-style: normal;
}

.landlord-bid-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 14px;
}

.game-panel.in-match .landlord-bid-actions {
  gap: 8px;
  margin-top: 12px;
}

.landlord-current-trick {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.game-panel.in-match .landlord-current-trick {
  gap: 10px;
}

.landlord-trick-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.landlord-trick-head strong {
  color: #f8fafc;
}

.landlord-trick-head span {
  color: var(--text-muted);
  font-size: 12px;
}

.landlord-hand-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.game-panel.in-match .landlord-hand-header {
  margin-bottom: 10px;
}

.landlord-hand-header strong {
  color: #f8fafc;
}

.landlord-hand-header span {
  color: var(--text-muted);
  font-size: 12px;
}

.landlord-card-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.game-panel.in-match .landlord-card-row {
  gap: 8px;
}

.landlord-card-row.table {
  align-items: center;
}

.landlord-card-row.hand {
  align-items: flex-end;
  padding-top: 10px;
}

.landlord-card {
  width: 60px;
  min-height: 86px;
  border-radius: 14px;
  border: 1px solid rgba(148, 163, 184, 0.22);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(226, 232, 240, 0.92));
  color: #0f172a;
  padding: 10px 8px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  align-items: flex-start;
  transition: transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease, opacity 0.18s ease;
}

.game-panel.in-match .landlord-card {
  width: 56px;
  min-height: 80px;
  padding: 8px 7px;
  border-radius: 12px;
}

.landlord-card:not(.static) {
  cursor: pointer;
}

.landlord-card:not(.static):hover {
  transform: translateY(-6px);
  border-color: rgba(96, 165, 250, 0.5);
  box-shadow: 0 14px 28px rgba(15, 23, 42, 0.2);
}

.landlord-card.static {
  cursor: default;
}

.landlord-card.red {
  color: #dc2626;
}

.landlord-card.selected {
  transform: translateY(-12px);
  border-color: rgba(96, 165, 250, 0.68);
  box-shadow: 0 16px 32px rgba(37, 99, 235, 0.18);
}

.game-panel.in-match .landlord-card.selected {
  transform: translateY(-10px);
}

.landlord-card.disabled {
  cursor: default;
  opacity: 0.82;
}

.landlord-card.disabled:hover {
  transform: none;
  border-color: rgba(148, 163, 184, 0.22);
  box-shadow: none;
}

.landlord-card-rank {
  font-size: 20px;
  font-weight: 700;
  line-height: 1;
}

.game-panel.in-match .landlord-card-rank {
  font-size: 18px;
}

.landlord-card-suit {
  font-size: 11px;
  opacity: 0.7;
}

.game-panel.in-match .landlord-card-suit {
  font-size: 10px;
}

.landlord-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 14px;
}

.video-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 14px;
}

.video-tile {
  position: relative;
  min-height: 164px;
  border-radius: 24px;
  overflow: hidden;
  background:
    linear-gradient(180deg, rgba(8, 15, 28, 0.86), rgba(15, 23, 42, 0.72));
  border: 1px solid rgba(167, 185, 210, 0.12);
  box-shadow: var(--shadow-soft);
}

.video-tile video {
  width: 100%;
  height: 100%;
  object-fit: cover;
  background: #020617;
}

.video-tile-label,
.video-tile em {
  position: absolute;
  left: 14px;
  bottom: 14px;
  background: rgba(8, 15, 28, 0.76);
  padding: 5px 9px;
  border-radius: 999px;
  font-style: normal;
  font-size: 12px;
  border: 1px solid rgba(167, 185, 210, 0.12);
}

.video-tile-label {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.video-tile-label span {
  color: #f8fafc;
}

.video-tile em {
  bottom: 40px;
  color: var(--text-muted);
}

.sidebar {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
  align-self: stretch;
  min-height: 0;
  max-height: 100%;
  overflow: hidden;
  padding: 14px;
  border-radius: 28px;
  border: 1px solid rgba(167, 185, 210, 0.12);
  background:
    radial-gradient(circle at top, rgba(59, 130, 246, 0.08), transparent 32%),
    linear-gradient(180deg, rgba(8, 15, 28, 0.74), rgba(10, 20, 36, 0.64));
  box-shadow: var(--shadow-soft);
}

.panel {
  background:
    linear-gradient(180deg, rgba(8, 15, 28, 0.9), rgba(10, 20, 36, 0.76));
  border: 1px solid rgba(167, 185, 210, 0.12);
  border-radius: 26px;
  padding: 18px;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03);
}

.panel-title {
  font-size: 16px;
  font-weight: 700;
  color: #ffffff;
  margin: 6px 0 0;
}

.panel-headline {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 14px;
  margin-bottom: 14px;
}

.panel-kicker {
  color: #fb7185;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.panel-meta {
  flex: 0 0 auto;
  min-height: 32px;
  padding: 0 10px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  background: rgba(59, 130, 246, 0.12);
  color: #dbeafe;
  font-size: 12px;
  font-weight: 700;
}

.participants-panel {
  flex: 0 0 auto;
  max-height: 264px;
  overflow: auto;
}

.participant-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.participant-invite-banner {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 12px;
  padding: 14px;
  border-radius: 18px;
  background:
    radial-gradient(circle at top left, rgba(59, 130, 246, 0.14), transparent 40%),
    rgba(8, 15, 28, 0.58);
  border: 1px solid rgba(96, 165, 250, 0.18);
}

.participant-invite-copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.participant-invite-kicker {
  color: #93c5fd;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.participant-invite-copy strong {
  color: #ffffff;
  font-size: 15px;
}

.participant-invite-copy span:last-child {
  color: var(--text-secondary);
  font-size: 12px;
  line-height: 1.6;
}

.participant-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  background: rgba(255, 255, 255, 0.05);
  padding: 10px 12px;
  border-radius: 16px;
  border: 1px solid rgba(167, 185, 210, 0.1);
}

.participant-item.invite-target {
  border-color: rgba(96, 165, 250, 0.24);
  background:
    radial-gradient(circle at right top, rgba(59, 130, 246, 0.12), transparent 32%),
    rgba(255, 255, 255, 0.06);
}

.participant-item.seat-assigned {
  border-color: rgba(34, 197, 94, 0.2);
}

.participant-main {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 10px;
}

.participant-copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.participant-copy > span {
  font-size: 13px;
}

.participant-tags,
.participant-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.participant-tag {
  font-size: 11px;
  color: #dbeafe;
}

.controller-tag {
  color: #a7f3d0;
}

.seat-tag {
  color: #bbf7d0;
}

.tiny-btn {
  min-height: 34px;
  border: 1px solid rgba(96, 165, 250, 0.14);
  border-radius: 12px;
  background: rgba(59, 130, 246, 0.14);
  color: #dbeafe;
  padding: 0 10px;
  font-size: 12px;
  cursor: pointer;
}

.tiny-btn.active {
  background: rgba(34, 197, 94, 0.22);
  color: #dcfce7;
}

.tiny-btn.danger {
  background: rgba(239, 68, 68, 0.18);
  color: #fecaca;
}

.admin-transfer-btn {
  background: rgba(168, 85, 247, 0.18);
  border-color: rgba(168, 85, 247, 0.25);
  color: #e9d5ff;
}

.admin-transfer-btn:hover {
  background: rgba(168, 85, 247, 0.28);
}

.chat-panel {
  flex: 1 1 0;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

.message-list {
  flex: 1 1 0;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-gutter: stable;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-right: 4px;
}

.message {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  background: rgba(255, 255, 255, 0.05);
  padding: 10px 12px;
  border-radius: 16px;
  border: 1px solid rgba(167, 185, 210, 0.1);
  line-height: 1.45;
}

.message.system {
  color: var(--text-muted);
  background: rgba(8, 15, 28, 0.56);
  font-size: 12px;
}

.message-copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.message strong {
  color: #f8fafc;
  font-size: 13px;
}

.message-copy span {
  color: var(--text-secondary);
  word-break: break-word;
  font-size: 12px;
}

.chat-input {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 8px;
  margin-top: 12px;
  align-items: center;
  padding: 10px;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(167, 185, 210, 0.12);
}

.chat-device-actions {
  display: flex;
  flex-wrap: nowrap;
  gap: 4px;
  align-items: center;
}

.device-toggle {
  position: relative;
  width: 40px;
  height: 40px;
  display: grid;
  place-items: center;
  border: 1px solid rgba(167, 185, 210, 0.16);
  background: rgba(8, 15, 28, 0.68);
  color: var(--text-muted);
  border-radius: 14px;
  cursor: pointer;
  flex: 0 0 auto;
  transition: transform 0.18s ease, background 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease, color 0.18s ease;
}

.device-toggle:hover {
  transform: translateY(-1px);
  background: rgba(15, 23, 42, 0.92);
  border-color: rgba(96, 165, 250, 0.32);
  color: #e2e8f0;
  box-shadow: 0 10px 24px rgba(2, 6, 23, 0.22);
}

.device-toggle:active {
  transform: scale(0.96);
}

.device-toggle:focus-visible {
  outline: none;
  border-color: rgba(96, 165, 250, 0.56);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2);
}

.device-toggle.active {
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.34), rgba(124, 58, 237, 0.48));
  border-color: rgba(96, 165, 250, 0.55);
  color: #f8fafc;
  box-shadow: 0 12px 28px rgba(37, 99, 235, 0.22);
}

.device-toggle.off::after {
  content: '';
  position: absolute;
  width: 2px;
  height: 22px;
  border-radius: 999px;
  background: #f87171;
  transform: rotate(-42deg);
}

.device-toggle-icon {
  width: 20px;
  height: 20px;
  stroke: currentColor;
  fill: none;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
  pointer-events: none;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.message-input {
  min-height: 40px;
  border: 1px solid rgba(167, 185, 210, 0.14);
  background: rgba(8, 15, 28, 0.64);
  color: #f8fafc;
  border-radius: 14px;
  padding: 0 10px;
  min-width: 0;
}

.message-input:focus {
  border-color: rgba(96, 165, 250, 0.34);
  background: rgba(10, 18, 32, 0.88);
}

.chat-send-btn {
  min-height: 40px;
  padding: 0 14px;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@keyframes remote-pulse {
  0% {
    transform: scale(0.92);
    opacity: 0.9;
  }

  100% {
    transform: scale(1.08);
    opacity: 0.25;
  }
}

@media (max-height: 900px) {
  .shared-stage.game-mode {
    height: clamp(540px, 83vh, 800px);
  }

  .game-stage {
    padding: 8px;
  }

  .game-panel.in-match {
    padding: 14px;
    gap: 10px;
  }

  .game-panel.in-match .game-panel-hero,
  .game-panel.in-match .game-mode-banner {
    padding: 10px 12px;
  }

  .game-panel.in-match .gomoku-board-shell {
    padding: 10px;
  }
}

@media (max-width: 1080px) {
  .content {
    grid-template-columns: 1fr;
  }

  .sidebar {
    height: auto;
    padding: 0;
    border: none;
    background: none;
    box-shadow: none;
  }

  .game-panel-hero,
  .game-mode-banner,
  .game-home-hero,
  .game-home-summary {
    flex-direction: column;
    align-items: flex-start;
  }

  .participants-panel {
    max-height: none;
  }

  .game-card,
  .gomoku-header,
  .landlord-header,
  .landlord-table-grid,
  .landlord-status-card {
    grid-template-columns: 1fr;
  }

  .game-catalog {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 720px) {
  .header {
    margin: 16px 16px 0;
    padding: 18px;
    flex-direction: column;
    align-items: stretch;
  }

  .content {
    padding-left: 16px;
    padding-right: 16px;
  }

  .room-title-row,
  .room-title-block,
  .section-title-row,
  .panel-headline {
    flex-direction: column;
    align-items: flex-start;
  }

  .stage-shell {
    padding: 12px;
  }

  .shared-stage {
    height: 320px;
  }

  .shared-stage.game-mode {
    height: clamp(420px, 72svh, 620px);
  }

  .share-toolbar {
    align-items: stretch;
  }

  .share-footer {
    flex-direction: column;
    align-items: stretch;
  }

  .game-panel-header,
  .game-invite-banner {
    flex-direction: column;
    align-items: stretch;
  }

  .game-card-topline {
    flex-direction: column;
    align-items: flex-start;
  }

  .game-seat-picker-header {
    flex-direction: column;
  }

  .game-home-actions {
    justify-content: stretch;
  }

  .game-home-actions .primary-btn {
    width: 100%;
  }

  .landlord-player-top,
  .landlord-trick-head {
    flex-direction: column;
    align-items: flex-start;
  }

  .landlord-card {
    width: 52px;
    min-height: 76px;
    padding: 8px 7px;
  }

  .landlord-card-rank {
    font-size: 18px;
  }

  .gomoku-board {
    width: 100%;
    padding: 14px;
  }

  .chat-input {
    grid-template-columns: 1fr;
  }

  .chat-device-actions {
    width: 100%;
  }

  .game-launcher-grid,
  .seat-picker-grid,
  .game-seat-grid.two-seat,
  .game-seat-grid.three-seat {
    grid-template-columns: 1fr;
  }
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(4px);
}

.modal-content {
  background: #1a1f2e;
  border-radius: 16px;
  width: 90%;
  max-width: 480px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.webpage-dialog .modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.modal-title {
  font-size: 18px;
  font-weight: 600;
  color: #f8fbff;
  margin: 0;
}

.modal-close {
  background: none;
  border: none;
  color: #94a3b8;
  font-size: 24px;
  cursor: pointer;
  padding: 4px 8px;
  line-height: 1;
  transition: color 0.2s;
}

.modal-close:hover {
  color: #f8fbff;
}

.webpage-dialog .modal-body {
  padding: 20px 24px;
}

.input-label {
  display: block;
  font-size: 14px;
  font-weight: 500;
  color: #cbd5e1;
  margin-bottom: 10px;
}

.text-input {
  width: 100%;
  padding: 12px 16px;
  background: rgba(15, 23, 42, 0.6);
  border: 1px solid rgba(148, 163, 184, 0.2);
  border-radius: 10px;
  color: #f8fbff;
  font-size: 15px;
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s;
  box-sizing: border-box;
}

.text-input:focus {
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
}

.text-input::placeholder {
  color: #64748b;
}

.input-hint {
  margin: 12px 0 0;
  font-size: 13px;
  color: #94a3b8;
  line-height: 1.5;
}

.webpage-dialog .modal-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 24px 20px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}
</style>
