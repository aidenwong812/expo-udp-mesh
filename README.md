After many attempts with different stacks and technologies, I've finally managed to send and receive messages between two mobile phones (using physical devices).

## OFF LINE - WITHOUT INTERNET

I used React Native Expo and followed this guide: https://martin-mule.medium.com/react-native-peer-to-peer-direct-connection-with-react-native-udp-b1ddc646d7a3

I created a simple, minimal MVP/POC. Then I built an .apk file and installed it on two Android devices.

To test:

Turn off cellular internet on both devices
Open a Hotspot on device A
Connect device B to device A's Wi-Fi (ignoring the warning about no internet connection)
Click 'Start server' on device A
On device B, enter device A's IP address and click 'Send message'

This is a significant milestone: we've achieved offline connection! 

Next steps are :

style the pages
 implement data storage and encrypt the messages.

Let me know if you have any questions!

did not test in in expo go because it RN lib and not RN Expo lib
so you need to

```bash
npx expo run:android
```

and run in on a device not simulator