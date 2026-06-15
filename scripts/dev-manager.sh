#!/bin/bash

# 多项目开发管理脚本

PROJECT_NAME="app-review-cool"
BASE_DIR=$(pwd)

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 显示帮助信息
show_help() {
    echo -e "${BLUE}=== $PROJECT_NAME 开发管理工具 ===${NC}"
    echo ""
    echo "用法: $0 [命令] [端口]"
    echo ""
    echo "命令:"
    echo "  start [port]    - 启动开发服务器 (默认端口: 3000)"
    echo "  stop [port]     - 停止指定端口的服务"
    echo "  status          - 查看所有端口状态"
    echo "  ports           - 显示常用端口分配"
    echo "  env [port]      - 切换到指定端口的环境配置"
    echo "  clean           - 清理缓存和临时文件"
    echo "  help            - 显示此帮助信息"
    echo ""
    echo "示例:"
    echo "  $0 start 4000   - 在端口 4000 启动服务"
    echo "  $0 stop 4000    - 停止端口 4000 的服务"
    echo "  $0 env 4000     - 切换到端口 4000 的环境配置"
}

# 显示端口分配
show_ports() {
    echo -e "${BLUE}=== 推荐端口分配 ===${NC}"
    echo "3000 - 默认 Next.js 项目"
    echo "4000 - AppStore 评论分析系统"
    echo "5000 - 其他 React/Vue 项目"
    echo "6000 - 后端 API 服务"
    echo "8000 - Python Django/Flask"
    echo "8080 - Java Spring Boot"
    echo "9000 - 其他服务"
}

# 检查端口是否被占用
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null ; then
        return 0  # 端口被占用
    else
        return 1  # 端口空闲
    fi
}

# 查看端口状态
show_status() {
    echo -e "${BLUE}=== 端口状态检查 ===${NC}"
    for port in 3000 4000 5000 6000 8000 8080 9000; do
        if check_port $port; then
            echo -e "端口 $port: ${RED}占用${NC}"
        else
            echo -e "端口 $port: ${GREEN}空闲${NC}"
        fi
    done
}

# 启动开发服务器
start_dev() {
    local port=${1:-3000}
    
    echo -e "${YELLOW}启动 $PROJECT_NAME 开发服务器 (端口: $port)...${NC}"
    
    # 检查端口是否被占用
    if check_port $port; then
        echo -e "${RED}错误: 端口 $port 已被占用${NC}"
        echo "请使用其他端口或先停止占用该端口的进程"
        return 1
    fi
    
    # 切换环境配置
    if [ -f ".env.port$port" ]; then
        echo -e "${YELLOW}使用端口 $port 的环境配置...${NC}"
        cp ".env.port$port" ".env.local"
    fi
    
    # 启动服务
    echo -e "${GREEN}在端口 $port 启动服务...${NC}"
    npm run dev:$port
}

# 停止服务
stop_dev() {
    local port=${1:-3000}
    
    echo -e "${YELLOW}停止端口 $port 的服务...${NC}"
    
    # 查找并杀死进程
    local pid=$(lsof -ti:$port)
    if [ ! -z "$pid" ]; then
        kill -9 $pid
        echo -e "${GREEN}已停止端口 $port 的服务 (PID: $pid)${NC}"
    else
        echo -e "${YELLOW}端口 $port 没有运行的服务${NC}"
    fi
}

# 切换环境配置
switch_env() {
    local port=${1:-3000}
    
    if [ -f ".env.port$port" ]; then
        cp ".env.port$port" ".env.local"
        echo -e "${GREEN}已切换到端口 $port 的环境配置${NC}"
    else
        echo -e "${RED}错误: 找不到端口 $port 的环境配置文件${NC}"
        echo "请先创建 .env.port$port 文件"
    fi
}

# 清理缓存
clean_cache() {
    echo -e "${YELLOW}清理项目缓存...${NC}"
    
    # 清理 Next.js 缓存
    rm -rf .next
    
    # 清理 node_modules (可选)
    read -p "是否删除 node_modules? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        rm -rf node_modules
        echo -e "${GREEN}已删除 node_modules，请运行 npm install 重新安装依赖${NC}"
    fi
    
    echo -e "${GREEN}缓存清理完成${NC}"
}

# 主逻辑
case "$1" in
    "start")
        start_dev $2
        ;;
    "stop")
        stop_dev $2
        ;;
    "status")
        show_status
        ;;
    "ports")
        show_ports
        ;;
    "env")
        switch_env $2
        ;;
    "clean")
        clean_cache
        ;;
    "help"|"")
        show_help
        ;;
    *)
        echo -e "${RED}未知命令: $1${NC}"
        show_help
        exit 1
        ;;
esac
