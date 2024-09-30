import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Button,
  TextInput,
  FlatList,
  StyleSheet,
  Alert,
  SafeAreaView,
} from "react-native";
import UdpSocket from "react-native-udp";
import { NetworkInfo } from "react-native-network-info";

const PORT = 8888;
const BROADCAST_ADDR = "255.255.255.255";

export default function App() {
  const [socket, setSocket] = useState(null);
  const [ipAddress, setIpAddress] = useState("");
  const [nodes, setNodes] = useState([]);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState("");
  const [currentRoom, setCurrentRoom] = useState("public");
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    setupNetwork();
    return () => {
      if (socket) {
        socket.close();
      }
    };
  }, []);

  const setupNetwork = async () => {
    try {
      const ip = await NetworkInfo.getIPV4Address();
      setIpAddress(ip);
      addLog(`Device IP: ${ip}`);

      const newSocket = UdpSocket.createSocket("udp4");
      newSocket.bind(PORT);

      newSocket.on("listening", () => {
        addLog(`Listening on port ${PORT}`);
        broadcastPresence(newSocket, ip);
      });

      newSocket.on("message", (msg, rinfo) =>
        handleIncomingMessage(msg, rinfo, ip)
      );

      newSocket.on("error", (err) => {
        addLog(`Socket error: ${err.message}`);
        Alert.alert("Network Error", `Socket error: ${err.message}`);
      });

      setSocket(newSocket);
    } catch (error) {
      addLog(`Setup error: ${error.message}`);
      Alert.alert("Setup Error", `Unable to set up network: ${error.message}`);
    }
  };

  const addLog = (message) => {
    setLogs((prevLogs) => [
      ...prevLogs,
      `[${new Date().toISOString()}] ${message}`,
    ]);
  };

  const broadcastPresence = (sock, ip) => {
    if (!ip) {
      addLog("Error: IP address is undefined in broadcastPresence");
      return;
    }

    const message = JSON.stringify({
      type: "presence",
      sender: ip,
    });
    addLog(`Sending presence: ${message}`);
    sock.send(message, 0, message.length, PORT, BROADCAST_ADDR, (error) => {
      if (error) {
        addLog(`Error broadcasting presence: ${error.message}`);
      } else {
        addLog("Presence broadcast sent");
      }
    });
  };

  const handleIncomingMessage = (msg, rinfo, ownIp) => {
    try {
      const data = JSON.parse(msg.toString());
      addLog(
        `Received message: ${JSON.stringify(data)} from: ${rinfo.address}`
      );

      if (data.sender === ownIp) {
        addLog("Ignoring own message");
        return;
      }

      switch (data.type) {
        case "presence":
          if (!nodes.includes(data.sender) && data.sender !== ownIp) {
            setNodes((prevNodes) => [...new Set([...prevNodes, data.sender])]);
            addLog(`New node discovered: ${data.sender}`);
            sendAcknowledgment(data.sender, ownIp);
          }
          break;
        case "chat":
          if (data.room === currentRoom || data.receiver === ownIp) {
            setMessages((prevMessages) => [
              ...prevMessages,
              {
                ...data,
                isPrivate: data.receiver === ownIp,
              },
            ]);
          }
          break;
        case "ack":
          if (!nodes.includes(data.sender)) {
            setNodes((prevNodes) => [...new Set([...prevNodes, data.sender])]);
            addLog(`Node acknowledged: ${data.sender}`);
          }
          break;
      }
    } catch (error) {
      addLog(`Error handling incoming message: ${error.message}`);
    }
  };

  const sendAcknowledgment = (target, ownIp) => {
    const ackMessage = JSON.stringify({
      type: "ack",
      sender: ownIp,
    });
    addLog(`Sending acknowledgment: ${ackMessage} to ${target}`);
    socket.send(ackMessage, 0, ackMessage.length, PORT, target, (error) => {
      if (error) {
        addLog(`Error sending acknowledgment: ${error.message}`);
      } else {
        addLog(`Acknowledgment sent to ${target}`);
      }
    });
  };

  const sendMessage = (receiver = null) => {
    if (!socket || !inputMessage.trim()) return;

    const message = JSON.stringify({
      type: "chat",
      sender: ipAddress,
      content: inputMessage,
      room: receiver ? null : currentRoom,
      receiver: receiver,
      timestamp: new Date().toISOString(),
    });

    const targets = receiver ? [receiver] : nodes;
    addLog(`Sending message: ${message} to ${targets.join(", ")}`);
    targets.forEach((target) => {
      socket.send(message, 0, message.length, PORT, target, (error) => {
        if (error) {
          addLog(`Error sending message to ${target}: ${error.message}`);
        } else {
          addLog(`Message sent to ${target}: ${inputMessage}`);
        }
      });
    });

    // Add the sent message to the messages state
    setMessages((prevMessages) => [
      ...prevMessages,
      {
        type: "chat",
        sender: ipAddress,
        content: inputMessage,
        room: receiver ? null : currentRoom,
        receiver: receiver,
        timestamp: new Date().toISOString(),
        isPrivate: !!receiver,
      },
    ]);

    setInputMessage("");
  };

  const refreshConnections = () => {
    if (socket && ipAddress) {
      broadcastPresence(socket, ipAddress);
      addLog("Manually refreshing connections");
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Mesh Chat App</Text>
      <Text>Your IP: {ipAddress}</Text>
      <Text>Current Room: {currentRoom}</Text>

      <View style={styles.nodesContainer}>
        <Text style={styles.subtitle}>Nodes in Network:</Text>
        <FlatList
          data={nodes}
          renderItem={({ item }) => <Text>{item}</Text>}
          keyExtractor={(item) => item}
        />
      </View>

      <Button title="Refresh Connections" onPress={refreshConnections} />

      <View style={styles.messagesContainer}>
        <Text style={styles.subtitle}>Messages:</Text>
        <FlatList
          data={messages}
          renderItem={({ item }) => (
            <Text
              style={
                item.isPrivate ? styles.privateMessage : styles.publicMessage
              }>
              {`${item.sender}: ${item.content} ${
                item.isPrivate ? "(Private)" : ""
              }`}
            </Text>
          )}
          keyExtractor={(item, index) => index.toString()}
        />
      </View>

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={inputMessage}
          onChangeText={setInputMessage}
          placeholder="Type a message..."
        />
        <Button title="Send to Room" onPress={() => sendMessage()} />
      </View>

      <View style={styles.privateMessageContainer}>
        <Text style={styles.subtitle}>Send Private Message:</Text>
        <FlatList
          data={nodes}
          renderItem={({ item }) => (
            <Button
              title={`Send to ${item}`}
              onPress={() => sendMessage(item)}
            />
          )}
          keyExtractor={(item) => item}
          horizontal={true}
        />
      </View>

      <View style={styles.logsContainer}>
        <Text style={styles.LogsSubtitle}>Logs:</Text>
        <FlatList
          data={logs.slice(-2)} // Only show the last 2 log entries
          renderItem={({ item }) => <Text style={styles.log}>{item}</Text>}
          keyExtractor={(item, index) => index.toString()}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 10,
    backgroundColor: "#f0f0f0",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginTop: 5,
    marginBottom: 5,
  },
  nodesContainer: {
    maxHeight: 100,
    marginBottom: 10,
  },
  messagesContainer: {
    flex: 1,
    marginBottom: 10,
    backgroundColor: "#ffffff",
    borderRadius: 5,
    padding: 5,
  },
  inputContainer: {
    flexDirection: "row",
    marginBottom: 10,
  },
  input: {
    flex: 1,
    borderColor: "#ccc",
    borderWidth: 1,
    padding: 10,
    marginRight: 10,
    backgroundColor: "#ffffff",
  },
  privateMessageContainer: {
    maxHeight: 100,
    marginBottom: 10,
  },
  logsContainer: {
    height: 70, // Reduced height to accommodate 2 lines
    backgroundColor: "#e0e0e0",
    borderRadius: 5,
    padding: 5,
  },
  LogsSubtitle: {
    fontSize: 12,
  },
  log: {
    fontSize: 10,
    color: "gray",
  },
  privateMessage: {
    fontStyle: "italic",
    color: "blue",
  },
  publicMessage: {
    color: "black",
  },
});
