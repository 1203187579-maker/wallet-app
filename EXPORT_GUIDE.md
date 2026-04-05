# 项目导出与本地打包指南

## 一、导出文件清单

### 必须导出的目录和文件

```
/workspace/projects/
│
├── client/                      # 前端项目 (必须)
│   ├── android/                 # Android 原生项目
│   │   ├── app/                 # 应用模块
│   │   ├── build.gradle
│   │   ├── gradle/
│   │   ├── gradle.properties
│   │   ├── gradlew
│   │   ├── gradlew.bat
│   │   ├── settings.gradle
│   │   ├── BUILD_GUIDE.md       # 打包指南
│   │   └── build-apk.sh         # 打包脚本
│   ├── app/                     # Expo Router 路由
│   ├── assets/                  # 静态资源
│   ├── components/              # 组件
│   ├── constants/               # 常量
│   ├── contexts/                # React Context
│   ├── hooks/                   # 自定义 Hooks
│   ├── i18n/                    # 国际化
│   ├── screens/                 # 页面
│   ├── scripts/                 # 脚本
│   ├── services/                # API 服务
│   ├── types/                   # TypeScript 类型
│   ├── utils/                   # 工具函数
│   ├── app.config.ts            # Expo 配置
│   ├── babel.config.js          # Babel 配置
│   ├── metro.config.js          # Metro 配置
│   ├── package.json             # 依赖配置
│   └── tsconfig.json            # TypeScript 配置
│
├── server/                      # 后端项目 (本地测试需要)
│   ├── src/                     # 源代码
│   ├── public/                  # 静态文件
│   ├── package.json
│   └── tsconfig.json
│
├── admin/                       # 管理后台 (可选)
│   ├── src/
│   ├── dist/
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
│
├── package.json                 # 根 package.json
├── pnpm-workspace.yaml          # pnpm 工作区配置
└── README.md                    # 项目说明
```

### 可忽略的目录（减少导出大小）

- `client/node_modules/` - 依赖包，可在本地重新安装
- `server/node_modules/` - 依赖包
- `admin/node_modules/` - 依赖包
- `client/android/.gradle/` - Gradle 缓存
- `client/android/app/build/` - 构建产物
- `client/.expo/` - Expo 缓存
- `*.log` - 日志文件

## 二、导出方式

### 方式 1: 压缩打包（推荐）

在沙箱中执行：
```bash
cd /workspace/projects

# 创建压缩包（排除 node_modules 和缓存）
tar -czvf project-export.tar.gz \
  --exclude='node_modules' \
  --exclude='.gradle' \
  --exclude='build' \
  --exclude='.expo' \
  --exclude='dist' \
  --exclude='*.log' \
  client/ server/ admin/ package.json pnpm-workspace.yaml README.md
```

### 方式 2: 使用 Git

如果项目已提交到 Git 仓库，可以直接克隆：
```bash
git clone <仓库地址>
```

## 三、本地环境搭建

### 1. 安装依赖

```bash
cd 项目根目录

# 安装 pnpm（如未安装）
npm install -g pnpm

# 安装所有依赖
pnpm install
```

### 2. 配置环境变量

创建 `client/.env` 文件：
```env
EXPO_PUBLIC_BACKEND_BASE_URL=http://你的服务器IP:9091
```

### 3. 创建 Android SDK 配置

创建 `client/android/local.properties`：
```properties
# macOS
sdk.dir=/Users/你的用户名/Library/Android/sdk

# Linux
sdk.dir=/home/你的用户名/Android/Sdk

# Windows
sdk.dir=C:\\Users\\你的用户名\\AppData\\Local\\Android\\Sdk
```

## 四、打包 APK

### 快速打包

```bash
cd client/android
chmod +x build-apk.sh
./build-apk.sh
```

### 手动打包

```bash
cd client/android
./gradlew assembleRelease
```

### APK 输出位置

```
client/android/app/build/outputs/apk/release/app-release.apk
```

## 五、后续测试

### 启动后端服务

```bash
cd server
pnpm run dev
```

### 启动管理后台

```bash
cd admin
pnpm run dev
```

### 安装 APK 到手机

```bash
adb install client/android/app/build/outputs/apk/release/app-release.apk
```

## 六、注意事项

1. **签名密钥**: 当前使用 debug 签名，正式发布需生成 release keystore
2. **API 地址**: 确保 `.env` 中的后端地址可访问
3. **网络配置**: 手机需能访问后端服务器（同一局域网或公网）
4. **首次构建**: 需下载依赖，耗时较长（约 10-30 分钟）

## 七、问题排查

| 问题 | 解决方案 |
|------|----------|
| JAVA_HOME 未设置 | 设置环境变量指向 Java 17 |
| ANDROID_HOME 未设置 | 设置环境变量指向 Android SDK |
| local.properties 不存在 | 手动创建并填写 SDK 路径 |
| 依赖下载失败 | 检查网络，考虑使用镜像 |
| 内存不足 | 修改 gradle.properties 增加 JVM 内存 |
